package org.civora.keycloak.sms;

import org.keycloak.email.EmailException;
import org.keycloak.email.EmailSenderProvider;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.RealmModel;

/**
 * Sends one SMS. No SMS provider is chosen (founder question Q3-1, pilot gate PG-6): the only sender is the SIMULATED one
 * (register entry M-01, class 3, ADR-028), which delivers to the dev and test mail catcher like the core's simulated SMS
 * adapter, accepts synthetic numbers only, and works only where the deployment says so (CIVORA_SIMULATED_SMS=allowed on
 * the Keycloak container: dev cell and tests). Anywhere else nothing is sent and the SMS step is unavailable (fail closed).
 */
public interface SmsSender {
    String REALM_ATTRIBUTE = "civora.sms.sender";

    void send(KeycloakSession session, RealmModel realm, String phone, String text) throws SmsNotSent;

    static SmsSender forRealm(RealmModel realm) throws SmsNotSent {
        String kind = realm.getAttribute(REALM_ATTRIBUTE);
        if ("simulated".equals(kind)) return new Simulated(System.getenv("CIVORA_SIMULATED_SMS"));
        throw new SmsNotSent("no SMS provider configured for this realm (Q3-1)");
    }

    final class Simulated implements SmsSender {
        private final String permission;

        public Simulated(String permission) {
            this.permission = permission;
        }

        public boolean allowed() {
            return "allowed".equals(permission);
        }

        /** Checks everything except the delivery itself (unit-tested). */
        public void check(String phone, String text) throws SmsNotSent {
            if (!allowed()) throw new SmsNotSent("the simulated SMS channel is not allowed in this deployment");
            if (phone == null || !SmsCodes.SYNTHETIC.matcher(phone).matches()) throw new SmsNotSent("only synthetic numbers (+2160xxxxxxx) in simulated mode");
            if (text == null || text.isEmpty() || text.length() > SmsCodes.MAX_TEXT) throw new SmsNotSent("an SMS holds 1 to 320 characters");
        }

        @Override
        public void send(KeycloakSession session, RealmModel realm, String phone, String text) throws SmsNotSent {
            check(phone, text);
            try {
                session.getProvider(EmailSenderProvider.class).send(realm.getSmtpConfig(), SmsCodes.simulatedMailbox(phone), "SMS", text, null);
            } catch (EmailException e) {
                throw new SmsNotSent("simulated SMS not delivered", e);
            }
        }
    }
}
