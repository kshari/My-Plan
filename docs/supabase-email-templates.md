# Customizing Supabase Auth Emails (e.g. Forgot Password)

Password reset and other auth emails are sent by Supabase. To show **My Plan** (or your app name) instead of Supabase branding, customize the templates in the Supabase Dashboard.

## Where to change it

1. Open [Supabase Dashboard](https://supabase.com/dashboard) and select your project.
2. Go to **Authentication** → **Email Templates**  
   Direct link: `https://supabase.com/dashboard/project/<your-project-ref>/auth/templates`
3. Select **Reset Password** (recovery).
4. Set the **Subject** and **Message body** as below (or adjust wording).

## Reset Password template

### Subject
```
Reset your password – My Plan
```

### Message body (HTML)

Use this and keep the `{{ .ConfirmationURL }}` link so the reset still works:

```html
<h2>My Plan – Reset your password</h2>
<p>You requested a password reset for your My Plan account.</p>
<p>Click the link below to choose a new password. This link expires in 1 hour.</p>
<p><a href="{{ .ConfirmationURL }}">Reset password</a></p>
<p>If you didn’t request this, you can ignore this email. Your password will stay the same.</p>
<p>— The My Plan team</p>
```

## Optional: Site URL

Under **Authentication** → **URL Configuration**, set **Site URL** to your app (e.g. `https://yourapp.com`). Supabase uses this when building links in emails.

## Other auth emails

From the same **Email Templates** page you can customize:

- **Confirm signup**
- **Magic Link**
- **Invite user**
- **Change email address**

Use the same branding and these variables when needed:

| Variable | Use |
|----------|-----|
| `{{ .ConfirmationURL }}` | Main action link (confirm, reset, etc.) |
| `{{ .Email }}` | User’s email |
| `{{ .SiteURL }}` | Your app URL from URL Configuration |

## Custom SMTP (optional)

By default, emails are sent by Supabase (from a Supabase domain). To send from your own domain and improve deliverability:

1. **Project Settings** → **Auth** → **SMTP**
2. Enable **Custom SMTP** and enter your provider’s SMTP details (SendGrid, Resend, Postmark, etc.).

After that, emails still use the templates above but are sent via your SMTP with your “From” address and domain.
