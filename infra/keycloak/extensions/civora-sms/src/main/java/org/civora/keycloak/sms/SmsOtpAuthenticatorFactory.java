package org.civora.keycloak.sms;

import java.util.List;
import org.keycloak.Config;
import org.keycloak.authentication.Authenticator;
import org.keycloak.authentication.AuthenticatorFactory;
import org.keycloak.models.AuthenticationExecutionModel;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.KeycloakSessionFactory;
import org.keycloak.provider.ProviderConfigProperty;

/** Registers the SMS step as authenticator "civora-sms-otp" (no configuration: the rules are fixed, doc phase-3/17). */
public class SmsOtpAuthenticatorFactory implements AuthenticatorFactory {
    public static final String ID = "civora-sms-otp";
    private static final AuthenticationExecutionModel.Requirement[] CHOICES = {
        AuthenticationExecutionModel.Requirement.ALTERNATIVE, AuthenticationExecutionModel.Requirement.REQUIRED, AuthenticationExecutionModel.Requirement.DISABLED,
    };
    private static final SmsOtpAuthenticator SINGLETON = new SmsOtpAuthenticator();

    @Override public String getId() { return ID; }
    @Override public String getDisplayType() { return "CIVORA code by SMS"; }
    @Override public String getHelpText() { return "A code sent to the verified phone number (doc phase-3/17); pages use the messages civora-sms-otp-display-name and civora-sms-otp-help-text"; }
    // "otp": one of the categories Keycloak's brute-force protection counts (password, otp, recovery-authn-codes; observed
    // on 26.8.1): a wrong SMS code then counts like a wrong authenticator-app code.
    @Override public String getReferenceCategory() { return "otp"; }
    @Override public boolean isConfigurable() { return false; }
    @Override public AuthenticationExecutionModel.Requirement[] getRequirementChoices() { return CHOICES; }
    @Override public boolean isUserSetupAllowed() { return false; }
    @Override public List<ProviderConfigProperty> getConfigProperties() { return List.of(); }
    @Override public Authenticator create(KeycloakSession session) { return SINGLETON; }
    @Override public void init(Config.Scope config) { }
    @Override public void postInit(KeycloakSessionFactory factory) { }
    @Override public void close() { }
}
