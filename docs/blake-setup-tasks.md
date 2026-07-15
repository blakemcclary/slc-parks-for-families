# For Blake: two quick setup tasks for Raised in SLC

Hey Blake, two small things I need your help with to get the new signup system
live. Neither one touches the live website. Together they take about 5 to 10
minutes. Thanks in advance!

---

## Task 1: Authorize Vercel on the GitHub repo (about 1 minute)

This lets the site auto-deploy when we push changes. It's all on GitHub's side,
you don't need a Vercel account, and it only grants access to the one repo.

1. Go to https://github.com/apps/vercel
2. Click **Configure** (if you've never used Vercel it'll say **Install**, same thing).
3. When GitHub asks which account to set it up on, pick your personal account, **blakemcclary**.
4. On the next screen, under **Repository access**, choose **Only select repositories**, then select **slc-parks-for-families** in the dropdown.
   - ("All repositories" also works, but selecting just the one repo is the tighter option.)
5. Click **Install / Save** at the bottom.

That's it. It's the standard Vercel and GitHub hookup and only touches that one repo.

---

## Task 2: Add Resend email DNS records in Namecheap (about 5 minutes)

We're switching the Raised in SLC signup emails over to Resend, and I need you to
add a few DNS records for `raisedinslc.org` in Namecheap. This only adds records
for sending email. It does **not** touch the website or any existing records, so
the live site is unaffected.

### Steps

1. Sign in to **Namecheap**, go to **Domain List**, find `raisedinslc.org`, and click **Manage**.
2. Open the **Advanced DNS** tab.
3. Under **Host Records**, click **Add New Record** for each row in the table below.
4. Important Namecheap notes:
   - In the **Host** field, enter ONLY the part shown below (e.g. `send`), NOT the full
     domain. Namecheap adds `.raisedinslc.org` automatically.
   - Do **not** add a trailing dot to any value.
   - Leave **TTL** on **Automatic**.
5. Click the green checkmark to save each record.

### Records to add

| Type | Host | Value | Priority |
|------|------|-------|----------|
| MX   | `send` | `feedback-smtp.us-east-1.amazonses.com` | `10` |
| TXT  | `send` | `v=spf1 include:amazonses.com ~all` | (none) |
| TXT  | `resend._domainkey` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCsvXGKMAtxMeo6NxnjXFAWDa+sdbJHn9SF/l0SZOkPIFoVvbx0iavUMZdjjUa/0izLFZy9W6QktDyfocfGWmwOJOJoThJCGFpcmuv9HSMhJiPIAc50jHK9ZPOSB4yj/2S0kFEi01VPKZOJNx1xF9WE1IhUKDUX+VLd/w0XI6h31wIDAQAB` | (none) |

(Optional but recommended, improves deliverability:)

| Type | Host | Value | Priority |
|------|------|-------|----------|
| TXT  | `_dmarc` | `v=DMARC1; p=none;` | (none) |

### Conflicts to check first

- **`_dmarc`**: only one DMARC record is allowed. If a `TXT` on host `_dmarc`
  already exists, do NOT add a second. Leave the existing one.
- **Root MX / SPF**: existing mail records live on host `@`. The records above
  are on host `send` (a subdomain) and do not conflict, so just add new rows,
  don't edit the `@` ones.
- **Mail Settings** dropdown must be set to **Custom MX** for the MX row to save
  (already the case if Google Workspace runs the domain's email).

### After saving

Just reply to let me know they're in. Namecheap usually propagates within a few
minutes to an hour, and I'll confirm verification on the Resend side. That's it,
thanks!
