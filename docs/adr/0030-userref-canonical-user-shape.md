# UserRef as the canonical user shape in API responses

Whenever a user is referenced from another resource (leaderboard row, subset owner, training owner, schedule creator, etc.) the API returns a consistent nested object — `UserRef: { id, displayName, avatarUrl, isPresent, countryCode }` — rather than flat root fields or ad-hoc nested shapes.

Before this decision, user data was embedded inconsistently: some endpoints used flat root fields (`ownerDisplayName`, `ownerAvatarUrl`), others used partial nested objects (`createdBy: { id, displayName, avatarUrl }`), and leaderboard rows mixed user fields in with row-level data. Adding `isPresent` and `countryCode` to all `UserAvatar` render sites made this inconsistency untenable — the alternative (adding `ownerIsPresent`, `ownerCountryCode` as further root fields) would deepen the inconsistency with each new user attribute.

All API responses that previously embedded user fields as flat root fields must migrate to a `UserRef` key. `AuthUser` (the `/auth/me` shape for the logged-in user) is a separate, fuller type and is not a `UserRef`.
