# KT Design Lab — Release 0.1

A first static-web release for **KT – A Complete PE & CS Design Lab**.

## Included
- Public landing page using the supplied `T&K Logo.jpg` asset.
- Supabase email/password login (invitation-only; no public sign-up form).
- Private member dashboard and initial tool library.
- Existing Universal Power Converter Compensator Lab copied unchanged into `tools/compensator-lab.html`.
- Starter Supabase schema with profile roles and per-user project-table RLS policies.

## Important release boundaries
- The other converter, magnetics, semiconductor and embedded-control categories are roadmap placeholders, not functioning calculators in this release.
- The dashboard's My Projects page is a placeholder. Use the compensator tool's own project export/import until cloud project sync is implemented.
- The embedded compensator tool still loads Plotly from jsDelivr, so its plotting functions need an internet connection. Its source was copied without changing its equations or calculation logic; no independent engineering validation is claimed in this package.
- Login is not active until you configure Supabase and deploy. **Important:** this is a static-site prototype. Supabase login gates the dashboard interface, but a static file such as `tools/compensator-lab.html` can still be fetched directly by someone who knows its URL. Do not treat the tool files or calculation logic as confidential or fully access-controlled in Release 0.1. Before using it for restricted engineering work, add a server-side/edge access check (for example, Cloudflare Access on a private app hostname or authenticated Pages Functions) and test direct URLs. Client-side JavaScript checks alone are not a security boundary.

## 1. Configure Supabase
1. Open your Supabase project (or create one) and copy the **Project URL** and **publishable/anon key** from Project Settings / API.
2. Open `config.js` and replace the two placeholders. The publishable/anon key is intended for browser use. **Never paste a service_role or secret key into `config.js`.**
3. In Supabase SQL Editor, run `supabase/schema.sql`.
4. In Authentication settings, enable the Email provider. Keep public sign-ups disabled. Use Dashboard → Authentication → Users → Add user → Send invitation to add each member.
5. Set the Auth Site URL to your deployed Cloudflare Pages URL. Add the exact deployed URL and any development URL you use to the allowed redirect URLs.
6. After your administrator account has accepted an invitation and signed in once, run the final `UPDATE` statement in `supabase/schema.sql` with your admin email to promote it. Do not give admin role to ordinary members.

## 2. Publish through GitHub + Cloudflare Pages
1. Extract this ZIP on your computer.
2. Open your existing private GitHub repository. Upload the **contents** of this folder (so `index.html` is at the repository root), commit to `main`, and keep the repository private.
3. In Cloudflare Dashboard → Workers & Pages → Create application → Pages → Connect to Git, choose the existing repository.
4. For this plain static site, choose no framework. Use an empty build command and set the build output directory to `.` (the repository root). Save and deploy.
5. Open the generated `*.pages.dev` URL. Verify the landing page, login, and tool page. Login should work only after the Supabase configuration and redirect URLs are correct.
6. Do not add a custom domain yet; the `pages.dev` address is sufficient for the first test release.

## 3. Add a custom domain later
When you decide and purchase a domain, add it in Cloudflare Pages → your project → Custom domains. Complete the DNS instructions shown there. Then update the Supabase Site URL and allowed redirect URLs to the custom domain. The domain name is not included or purchased by this package.

## 4. Local preview
You can preview the public landing page by opening `index.html`. For auth testing and reliable relative paths, serve the folder through a local static server (for example VS Code Live Server). Supabase redirect URLs must include the local origin if you test email links locally.

## Security checklist before inviting members
- Decide how to protect direct tool URLs. The dashboard login alone does not secure static files; configure Cloudflare Access or server-side/edge authorization before treating the tool area as private.
- Keep the GitHub repository private.
- Keep `config.js` limited to the Supabase URL and publishable/anon key.
- Never commit service-role keys, passwords, API secrets or personal member data.
- Run the SQL schema and verify RLS is enabled on both tables.
- Test with two invited accounts: each must be unable to read or modify the other's project rows.
- Confirm public sign-up is disabled in Supabase Auth settings.
- Configure email delivery/SMTP for reliable invitation and password-reset messages before wider rollout.

## Suggested GitHub repository structure
```
index.html
styles.css
app.js
config.js
config.example.js
assets/T&K Logo.jpg
tools/compensator-lab.html
supabase/schema.sql
README.md
```
