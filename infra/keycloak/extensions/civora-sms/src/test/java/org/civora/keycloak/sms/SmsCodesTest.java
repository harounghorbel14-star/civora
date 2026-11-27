package org.civora.keycloak.sms;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Proxy;
import java.security.SecureRandom;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.keycloak.models.RealmModel;
import org.keycloak.models.RoleModel;
import org.keycloak.models.UserModel;

class SmsCodesTest {
    @Test
    void codesAreSixDigitsAndVaried() {
        SecureRandom r = new SecureRandom();
        Set<String> seen = new HashSet<>();
        for (int i = 0; i < 200; i++) {
            String c = SmsCodes.newCode(r);
            assertTrue(c.matches("[0-9]{6}"), c);
            seen.add(c);
        }
        assertTrue(seen.size() > 190, "random codes rarely repeat");
    }

    @Test
    void aCodeMatchesOnlyItsOwnSignIn() {
        String d = SmsCodes.digest("session-1.tab-a", "123456");
        assertTrue(SmsCodes.matches(d, "session-1.tab-a", "123456"));
        assertFalse(SmsCodes.matches(d, "session-1.tab-b", "123456"), "bound to the sign-in (session and tab)");
        assertFalse(SmsCodes.matches(d, "session-1.tab-a", "123457"));
        assertFalse(SmsCodes.matches(d, "session-1.tab-a", "12345"), "six digits only");
        assertFalse(SmsCodes.matches(d, "session-1.tab-a", " 123456"));
        assertFalse(SmsCodes.matches(null, "session-1.tab-a", "123456"), "no code sent: nothing matches");
        assertFalse(d.contains("123456"), "only a digest is kept");
    }

    @Test
    void numbersAndWhatThePageShows() {
        assertTrue(SmsCodes.wellFormedPhone("+21600000001"));
        assertFalse(SmsCodes.wellFormedPhone("21600000001"));
        assertFalse(SmsCodes.wellFormedPhone("+2160000"));
        assertEquals("01", SmsCodes.ending("+21600000001"));
        assertEquals("sms.21600000001@sms.civora-cell.invalid", SmsCodes.simulatedMailbox("+21600000001"));
        assertEquals(3, SmsCodes.parse("3", 0));
        assertEquals(0, SmsCodes.parse("x", 0));
        assertEquals(300, SmsCodes.TTL_SECONDS, "5 minutes (ASVS V6.5.5: at most 10)");
    }

    @Test
    void theSimulatedChannelFailsClosed() throws Exception {
        assertThrows(SmsNotSent.class, () -> new SmsSender.Simulated(null).check("+21600000001", "x"), "not allowed unless the deployment says so");
        assertThrows(SmsNotSent.class, () -> new SmsSender.Simulated("yes").check("+21600000001", "x"));
        SmsSender.Simulated sim = new SmsSender.Simulated("allowed");
        sim.check("+21600000001", "CIVORA: 123456");
        assertThrows(SmsNotSent.class, () -> sim.check("+21698765432", "x"), "a real number is never used in simulated mode");
        assertThrows(SmsNotSent.class, () -> sim.check("+21600000001", "x".repeat(321)));
        assertThrows(SmsNotSent.class, () -> SmsSender.forRealm(realm(Map.of(), Set.of())), "no provider configured: nothing is sent");
        assertTrue(SmsSender.forRealm(realm(Map.of(SmsSender.REALM_ATTRIBUTE, "simulated"), Set.of())) instanceof SmsSender.Simulated);
    }

    @Test
    void onlyVerifiedNumbersAndNeverTheExcludedRole() {
        RealmModel citizens = realm(Map.of(SmsSender.REALM_ATTRIBUTE, "simulated"), Set.of());
        RealmModel staff = realm(Map.of(SmsSender.REALM_ATTRIBUTE, "simulated", SmsOtpAuthenticator.EXCLUDED_ROLE, "officer"), Set.of("officer"));
        RealmModel broken = realm(Map.of(SmsSender.REALM_ATTRIBUTE, "simulated", SmsOtpAuthenticator.EXCLUDED_ROLE, "no-such-role"), Set.of());
        assertFalse(SmsOtpAuthenticator.eligible(realm(Map.of(), Set.of()), user("+21600000001", "true", true, Set.of())), "no sender configured: never offered");
        UserModel verified = user("+21600000001", "true", true, Set.of());
        assertTrue(SmsOtpAuthenticator.eligible(citizens, verified));
        assertFalse(SmsOtpAuthenticator.eligible(citizens, user("+21600000001", null, true, Set.of())), "a number not verified");
        assertFalse(SmsOtpAuthenticator.eligible(citizens, user("not-a-number", "true", true, Set.of())));
        assertFalse(SmsOtpAuthenticator.eligible(citizens, user("+21600000001", "true", false, Set.of())), "a disabled account");
        assertFalse(SmsOtpAuthenticator.eligible(citizens, null));
        assertTrue(SmsOtpAuthenticator.eligible(staff, verified), "staff who are not officers");
        assertFalse(SmsOtpAuthenticator.eligible(staff, user("+21600000001", "true", true, Set.of("officer"))), "officers keep the security key only (P3-SEC5)");
        assertFalse(SmsOtpAuthenticator.eligible(broken, verified), "an excluded role that does not exist excludes everyone");
    }

    // Minimal stand-ins for Keycloak's models (only what the rules read).
    private static RealmModel realm(Map<String, String> attributes, Set<String> roles) {
        return (RealmModel) Proxy.newProxyInstance(RealmModel.class.getClassLoader(), new Class<?>[] { RealmModel.class }, (p, m, a) -> switch (m.getName()) {
            case "getAttribute" -> a.length == 1 ? attributes.get((String) a[0]) : null;
            case "getRole" -> roles.contains((String) a[0]) ? role((String) a[0]) : null;
            default -> throw new UnsupportedOperationException(m.getName());
        });
    }

    private static RoleModel role(String name) {
        return (RoleModel) Proxy.newProxyInstance(RoleModel.class.getClassLoader(), new Class<?>[] { RoleModel.class }, (p, m, a) -> switch (m.getName()) {
            case "getName" -> name;
            case "equals" -> a[0] == p;
            case "hashCode" -> name.hashCode();
            default -> throw new UnsupportedOperationException(m.getName());
        });
    }

    private static UserModel user(String phone, String verified, boolean enabled, Set<String> roles) {
        return (UserModel) Proxy.newProxyInstance(UserModel.class.getClassLoader(), new Class<?>[] { UserModel.class }, (p, m, a) -> switch (m.getName()) {
            case "isEnabled" -> enabled;
            case "getFirstAttribute" -> switch ((String) a[0]) {
                case SmsOtpAuthenticator.PHONE -> phone;
                case SmsOtpAuthenticator.PHONE_VERIFIED -> verified;
                default -> null;
            };
            case "hasRole" -> roles.contains(((RoleModel) a[0]).getName());
            default -> throw new UnsupportedOperationException(m.getName());
        });
    }
}
