package org.civora.keycloak.sms;

/** The SMS could not be sent (no provider, a number the channel does not accept, the relay down). */
public class SmsNotSent extends Exception {
    public SmsNotSent(String message) {
        super(message);
    }

    public SmsNotSent(String message, Throwable cause) {
        super(message, cause);
    }
}
