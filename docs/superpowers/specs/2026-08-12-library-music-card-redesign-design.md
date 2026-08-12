# Library Music Card Redesign

## Goal

Redesign the Library music list to match the supplied mobile reference while keeping the existing application structure and behavior. The outer list must stay compact and must not expose an item's date or time. Date and time remain available only in the focused listening detail opened from the play control.

## Approved interaction

- Keep all six library category buttons on one row at every supported mobile width.
- Present each media item as a clean rounded card with a larger category icon, a strong title, a genre or supporting metadata badge, and a right-aligned action cluster.
- Use an icon-only circular play button when an item has an MP3 URL.
- Use an icon-only upload/music button when an item has no MP3 URL; it opens the existing edit flow.
- Keep status, favorite, and edit controls visible on the outer card.
- Remove the log date and log time from every outer list card, including Favorites.
- Pressing play opens the existing focused detail view. That view shows the item date and time together with the single audio player and Back action.

## Visual direction

Use the current design tokens so light and dark themes remain compatible. Increase card radius, spacing, icon size, and button hit targets to evoke the reference without duplicating device chrome or adding a second application header. On narrow screens the information column may shrink, but the control cluster must stay within the card and the six category buttons must not wrap.

## Accessibility and responsive behavior

Icon-only controls retain descriptive `aria-label` and `title` text. Interactive controls target approximately 40px where space allows. Long titles truncate or wrap inside the content column without pushing controls outside the card. The focused detail heading receives focus after navigation, and Back returns to the Library list.

## Scope

Only the Library presentation components, their styles, and Library tests are in scope. Existing Tasks, database, dependency, and Supabase changes in the working tree are unrelated and must not be staged.
