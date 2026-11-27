package org.civora.keycloak.sms;

import jakarta.ws.rs.core.MultivaluedMap;
import jakarta.ws.rs.core.Response;
import java.security.SecureRandom;
import java.text.MessageFormat;
import java.util.Locale;
import java.util.Properties;
import org.jboss.logging.Logger;
import org.keycloak.authentication.AuthenticationFlowContext;
import org.keycloak.authentication.AuthenticationFlowError;
import org.keycloak.authentication.Authenticator;
import org.keycloak.events.Errors;
import org.keycloak.forms.login.LoginFormsProvider;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.RealmModel;
import org.keycloak.models.RoleModel;
import org.keycloak.models.UserModel;
import org.keycloak.models.utils.FormMessage;
import org.keycloak.sessions.AuthenticationSessionModel;
import org.keycloak.theme.Theme;

/**
 * A code by SMS as a fallback second step (doc phase-3/17; founder decision Q3-7; ASVS deviation D5). Offered only to
 * an account whose phone number the core verified (user-profile attributes phone_number and phone_number_verified,
 * editable by administrators only), and never to a holder of the realm's excluded role (staff realm: officer, who keeps
 * the security key only, P3-SEC5). Wrong codes count for the realm's brute-force protection and are recorded as sign-in
 * errors marked civora_second_factor=sms, so the core can tell the person "right password, second step failed".
 */
public class SmsOtpAuthenticator implements Authenticator {
    static final String FORM = "login-civora-sms.ftl";
    static final String FIELD = "civora-sms-code";
    static final String NOTE_DIGEST = "civora.sms.digest";
    static final String NOTE_EXPIRES = "civora.sms.expires";
    static final String NOTE_ATTEMPTS = "civora.sms.attempts";
    static final String NOTE_SENDS = "civora.sms.sends";
    public static final String PHONE = "phone_number";
    public static final String PHONE_VERIFIED = "phone_number_verified";
    public static final String EXCLUDED_ROLE = "civora.sms.excludedRole";
    private static final Logger LOG = Logger.getLogger(SmsOtpAuthenticator.class);
    private static final SecureRandom RANDOM = new SecureRandom();

    /** Whether this account may use the SMS step in this realm. */
    public static boolean eligible(RealmModel realm, UserModel user) {
        if (user == null || !user.isEnabled()) return false;
        if (realm.getAttribute(SmsSender.REALM_ATTRIBUTE) == null) return false; // no sender in this deployment: never offered
        if (!"true".equals(user.getFirstAttribute(PHONE_VERIFIED)) || !SmsCodes.wellFormedPhone(user.getFirstAttribute(PHONE))) return false;
        String excluded = realm.getAttribute(EXCLUDED_ROLE);
        if (excluded != null && !excluded.isBlank()) {
            RoleModel role = realm.getRole(excluded.trim());
            if (role == null || user.hasRole(role)) return false; // a missing role excludes everyone (fail closed)
        }
        return true;
    }

    private static String bindTo(AuthenticationSessionModel as) {
        return as.getParentSession().getId() + "." + as.getTabId();
    }

    /**
     * Keycloak lists every non-credential step under "Try another way", whoever signs in (observed on 26.8.1): an
     * account that may not use SMS (no verified number, an officer) gets a page saying so, with "Try another way";
     * no code is ever sent to it.
     */
    private static void unavailable(AuthenticationFlowContext ctx) {
        ctx.challenge(ctx.form().setAttribute("civoraSmsUnavailable", true).setError("civoraSmsUnavailable").createForm(FORM));
    }

    @Override
    public void authenticate(AuthenticationFlowContext ctx) {
        if (!eligible(ctx.getRealm(), ctx.getUser())) {
            unavailable(ctx);
            return;
        }
        AuthenticationSessionModel as = ctx.getAuthenticationSession();
        boolean current = as.getAuthNote(NOTE_DIGEST) != null && System.currentTimeMillis() < SmsCodes.parse(as.getAuthNote(NOTE_EXPIRES), 0) * 1000L;
        if (!current && !send(ctx)) return;
        ctx.challenge(form(ctx).createForm(FORM));
    }

    @Override
    public void action(AuthenticationFlowContext ctx) {
        UserModel user = ctx.getUser();
        if (!eligible(ctx.getRealm(), user)) {
            unavailable(ctx);
            return;
        }
        MultivaluedMap<String, String> params = ctx.getHttpRequest().getDecodedFormParameters();
        AuthenticationSessionModel as = ctx.getAuthenticationSession();
        if (params.containsKey("resend")) {
            if (send(ctx)) ctx.challenge(form(ctx).setInfo("civoraSmsResent").createForm(FORM));
            return;
        }
        String typed = params.getFirst(FIELD) == null ? "" : params.getFirst(FIELD).trim();
        String digest = as.getAuthNote(NOTE_DIGEST);
        long expires = SmsCodes.parse(as.getAuthNote(NOTE_EXPIRES), 0) * 1000L;
        if (digest == null || System.currentTimeMillis() >= expires) {
            ctx.getEvent().user(user).detail("civora_second_factor", "sms").error(Errors.EXPIRED_CODE);
            ctx.failureChallenge(AuthenticationFlowError.EXPIRED_CODE, form(ctx).addError(new FormMessage("civoraSmsCode", "civoraSmsExpired")).createForm(FORM));
            return;
        }
        if (!SmsCodes.matches(digest, bindTo(as), typed)) {
            int attempts = SmsCodes.parse(as.getAuthNote(NOTE_ATTEMPTS), 0) + 1;
            as.setAuthNote(NOTE_ATTEMPTS, String.valueOf(attempts));
            ctx.getEvent().user(user).detail("civora_second_factor", "sms").error(Errors.INVALID_USER_CREDENTIALS);
            if (attempts >= SmsCodes.MAX_ATTEMPTS) {
                as.removeAuthNote(NOTE_DIGEST); // this code is finished; a new one must be asked for
                ctx.failureChallenge(AuthenticationFlowError.INVALID_CREDENTIALS, form(ctx).addError(new FormMessage("civoraSmsCode", "civoraSmsTooMany")).createForm(FORM));
            } else {
                ctx.failureChallenge(AuthenticationFlowError.INVALID_CREDENTIALS, form(ctx).addError(new FormMessage("civoraSmsCode", "civoraSmsInvalid")).createForm(FORM));
            }
            return;
        }
        as.removeAuthNote(NOTE_DIGEST);
        as.removeAuthNote(NOTE_EXPIRES);
        as.removeAuthNote(NOTE_ATTEMPTS);
        ctx.success();
    }

    /** A new code (at most MAX_SENDS per sign-in); false when none could be sent (the page then says so). */
    private boolean send(AuthenticationFlowContext ctx) {
        AuthenticationSessionModel as = ctx.getAuthenticationSession();
        int sends = SmsCodes.parse(as.getAuthNote(NOTE_SENDS), 0);
        if (sends >= SmsCodes.MAX_SENDS) {
            ctx.challenge(form(ctx).setError("civoraSmsNoMoreCodes").createForm(FORM));
            return false;
        }
        String code = SmsCodes.newCode(RANDOM);
        KeycloakSession session = ctx.getSession();
        RealmModel realm = ctx.getRealm();
        UserModel user = ctx.getUser();
        try {
            SmsSender sender = SmsSender.forRealm(realm);
            sender.send(session, realm, user.getFirstAttribute(PHONE), text(session, realm, user, code));
        } catch (SmsNotSent e) {
            LOG.warnf("civora-sms: code not sent (%s)", e.getMessage());
            ctx.challenge(form(ctx).setError("civoraSmsNotSent").createForm(FORM));
            return false;
        }
        as.setAuthNote(NOTE_DIGEST, SmsCodes.digest(bindTo(as), code));
        as.setAuthNote(NOTE_EXPIRES, String.valueOf(System.currentTimeMillis() / 1000L + SmsCodes.TTL_SECONDS));
        as.setAuthNote(NOTE_ATTEMPTS, "0");
        as.setAuthNote(NOTE_SENDS, String.valueOf(sends + 1));
        return true;
    }

    /** The SMS text in the person's language (theme messages civoraSmsText: {0} the code, {1} minutes). */
    static String text(KeycloakSession session, RealmModel realm, UserModel user, String code) {
        Locale locale = session.getContext().resolveLocale(user);
        String pattern = null;
        try {
            Properties messages = session.theme().getTheme(Theme.Type.LOGIN).getEnhancedMessages(realm, locale);
            pattern = messages.getProperty("civoraSmsText");
        } catch (Exception e) {
            LOG.debugf("civora-sms: messages not readable (%s)", e.getMessage());
        }
        if (pattern == null) pattern = "CIVORA: {0} ({1} min)";
        return new MessageFormat(pattern, locale).format(new Object[] { code, String.valueOf(SmsCodes.TTL_SECONDS / 60) });
    }

    private static LoginFormsProvider form(AuthenticationFlowContext ctx) {
        return ctx.form().setAttribute("civoraSmsEnding", SmsCodes.ending(ctx.getUser().getFirstAttribute(PHONE)));
    }

    @Override
    public boolean requiresUser() {
        return true;
    }

    @Override
    public boolean configuredFor(KeycloakSession session, RealmModel realm, UserModel user) {
        return eligible(realm, user);
    }

    @Override
    public void setRequiredActions(KeycloakSession session, RealmModel realm, UserModel user) {
        // Nothing to set up at sign-in: the number is added and verified through the core (doc phase-3/16).
    }

    @Override
    public void close() {
    }
}
