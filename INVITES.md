# Invites

Email invites are crew, connection, organization, and boat. Every invite can create an account.

- Skip email verification when someone accepts an email invite. Opening the link and finishing account setup, such as choosing a password, marks the account verified (`emailVerified = true`). Do not send a separate verification email.
- The invite link uses a cryptographically random token that expires after 7 days. Opening the link does not consume it. Accepting it does, once. Accepting again as the same person changes nothing.
- If the token has expired, the invite page shows the invited email already filled in. They can request a fresh link that verifies an existing account or creates one. That link does not renew the invite. Do not show the invite artwork or the "you have been invited" message once the token has expired.

# List of invites

- Crew invite — deep link to the inviter. If that person has a trip in progress which this crew member can see, open that trip instead.
- Invite to connect — deep link to the person-to-person chat, with a message that the two users are now connected ("You and <user name> are connected").
- Invite to an organization — deep link to the organization.
- Invite to a boat — deep link to the boat.

If accepting created a referral, add a system message in the direct chat with the inviter. A referral is created only for a new account, and only for the first invite. The message explains the referral bonus and that the inviter accrues doubloons as the invitee spends them. Whichever invite created the referral gets this message, including a boat, crew, or organization invite whose own deep link opens somewhere else.

# Invite deep-linking

- Emails use Universal Links on iOS and App Links on Android: `https` links on the site domain. Shipping that needs an app update.
- If the app is not installed, the link opens the site, not the app store.
- Save the landing on the account when the invite is accepted, so installing the app later opens the same place.

# Signup screens

- If someone without an account opens an invite, use the token to adjust the signup screen.
  - Prefill the email and keep it on the invited address.
  - While the token is valid and the email is still the invited address, hide Magic Link and Resend Verification. Leave Forgot password available. The choice on screen is creating a password or signing in with OAuth.
  - Google or Apple with a different email signs them into that account and leaves the invite pending for the address it was sent to.
  - While the token is valid, show:
    - Boat invite: a circular boat image, "You have been invited to join <boat name>", and the boat's members as circular profile icons.
    - Crew invite: a circular image of the inviter, "You have been invited to join a crew with <user name>", and the other crew members as circular profile icons.
    - Organization invite: a circular organization image, "You have been invited to join <org name>". Boats in a fan when there is more than one, one circular boat image when there is one, and the organization's members as circular profile icons.
    - Connection invite: the inviter's profile image and "<user name> wants to connect".
