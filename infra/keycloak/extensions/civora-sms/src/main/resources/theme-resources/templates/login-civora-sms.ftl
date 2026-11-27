<#import "template.ftl" as layout>
<#import "field.ftl" as field>
<#import "buttons.ftl" as buttons>
<@layout.registrationLayout displayMessage=!messagesPerField.existsError('civoraSmsCode'); section>
<!-- template: login-civora-sms.ftl (CIVORA, doc phase-3/17) -->
    <#if section="header">
        ${msg("civoraSmsTitle")}
    <#elseif section="form">
      <#if civoraSmsUnavailable??>
        <p id="civora-sms-unavailable">${msg("civoraSmsUnavailableHelp")}</p>
      <#else>
        <p id="civora-sms-sent">${msg("civoraSmsSent", civoraSmsEnding!"")}</p>
        <form id="kc-sms-login-form" class="${properties.kcFormClass!}" onsubmit="login.disabled = true; return true;" action="${url.loginAction}" method="post">
            <@field.input name="civora-sms-code" label=msg("civoraSmsCode") autocomplete="one-time-code" fieldName="civoraSmsCode" autofocus=true />
            <@buttons.loginButton />
        </form>
        <form id="kc-sms-resend-form" action="${url.loginAction}" method="post">
            <input type="hidden" name="resend" value="1">
            <@buttons.actionGroup>
                <@buttons.button id="civora-sms-resend" name="resend-button" label="civoraSmsResend" type="secondary" />
            </@buttons.actionGroup>
        </form>
      </#if>
    </#if>
</@layout.registrationLayout>
