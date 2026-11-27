package org.civora.keycloak.sms;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.HexFormat;
import java.util.regex.Pattern;

/**
 * The rules of an SMS sign-in code (doc phase-3/17, deviation D5): six digits from a CSPRNG, kept only as a digest
 * bound to the sign-in (authentication session and tab), 5 minutes, 5 tries, at most 3 codes per sign-in.
 */
public final class SmsCodes {
    /** E.164, as the realms' user profile and the core check. */
    public static final Pattern E164 = Pattern.compile("^\\+[1-9][0-9]{7,14}$");
    /** Synthetic numbers: +2160 and 7 digits (no Tunisian number starts with 0 after the country code). */
    public static final Pattern SYNTHETIC = Pattern.compile("^\\+2160[0-9]{7}$");
    private static final Pattern CODE = Pattern.compile("^[0-9]{6}$");
    public static final int TTL_SECONDS = 300;
    public static final int MAX_ATTEMPTS = 5;
    public static final int MAX_SENDS = 3;
    public static final int MAX_TEXT = 320;

    private SmsCodes() {}

    public static String newCode(SecureRandom random) {
        return String.format("%06d", random.nextInt(1_000_000));
    }

    public static String digest(String bindTo, String code) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(md.digest(("civora-sms\0" + bindTo + "\0" + code).getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    /** Constant-time comparison of the typed code with the stored digest. */
    public static boolean matches(String expectedDigest, String bindTo, String typed) {
        if (expectedDigest == null || typed == null || !CODE.matcher(typed).matches()) return false;
        return MessageDigest.isEqual(expectedDigest.getBytes(StandardCharsets.US_ASCII), digest(bindTo, typed).getBytes(StandardCharsets.US_ASCII));
    }

    public static boolean wellFormedPhone(String phone) {
        return phone != null && E164.matcher(phone).matches();
    }

    /** What the sign-in page may show of the number: its last two digits. */
    public static String ending(String phone) {
        return phone == null || phone.length() < 2 ? "" : phone.substring(phone.length() - 2);
    }

    /** Where the simulated channel delivers (the dev and test mail catcher), as the core's simulated SMS adapter does. */
    public static String simulatedMailbox(String phone) {
        return "sms." + phone.replaceAll("[^0-9]", "") + "@sms.civora-cell.invalid";
    }

    public static int parse(String value, int fallback) {
        try {
            return value == null ? fallback : Integer.parseInt(value);
        } catch (NumberFormatException e) {
            return fallback;
        }
    }
}
