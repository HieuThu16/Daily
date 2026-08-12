# Library Audio Detail UI Design

## Goal

Make the mobile Library view compact and easy to scan. All six media-category buttons must remain on one row. Music and YouTube cards must not embed audio players in the list. Playback moves to a focused detail view with an explicit back action.

## Scope

- Update the category selector and media-card layout in `LibraryPage`.
- Add an in-page audio detail state for Music and YouTube items.
- Reuse the existing edit modal for items that do not yet have an MP3 URL.
- Preserve the current filtering, status, favorite, edit, conversion, and persistence behavior.
- Keep the application bottom navigation visible while the audio detail view is open.

Database schema, conversion logic, Supabase functions, and other Library item types are outside this change.

## Category Selector

The selector uses six equal-width columns: All, Book, Manga, Movie, YouTube, and Music. Each button may reduce horizontal padding and icon-box size on narrow screens, but the row must not wrap or scroll horizontally. Touch targets remain at least 40 pixels high.

The active category keeps the existing blue outline and selected styling. Category labels remain available through each button's `title` and accessible label even though the visible control uses icons.

## List Cards

Music and YouTube cards no longer render an HTML audio player. Their metadata remains compact and readable.

The right-side actions are:

- **Nghe** when `audio_url` exists. It opens the audio detail view.
- **Thêm MP3** when `audio_url` is missing. It opens the existing edit modal so the user can add or convert audio.
- Favorite and edit icon buttons retain their current behavior.
- The status selector retains its current behavior.

On narrow screens, controls stay on one row and use compact labels and spacing. Metadata may wrap beneath the title, but the action group must stay inside the card.

Non-audio Library types retain their current card actions and do not receive a playback button.

## Audio Detail View

`LibraryPage` owns a nullable `selectedAudioItem` state. When it contains an item, the normal Library title, category controls, sub-tabs, filters, and list are replaced by a focused detail view. The global application header and bottom navigation remain visible.

The detail view contains:

1. A prominent **← Quay lại** button.
2. Media-type icon, title, artist or channel, genre, status, favorite state, and saved date/time.
3. One full-width HTML audio player sourced from `audio_url`.
4. An external YouTube link when `youtube_url` exists.
5. An edit action for updating metadata or regenerating the MP3.

Pressing **Quay lại** clears `selectedAudioItem` and returns to the existing Library view without resetting category, sub-view, status filter, genre filter, or search state. The list is not remounted outside `LibraryPage`, so its current scroll/filter context is retained as far as browser layout permits.

If the underlying item changes while the detail view is open, the view resolves the latest item by ID from the current items collection. If the item is deleted, the detail view closes and returns to the list.

## Audio Errors

If playback fails, the detail screen remains open and shows a clear inline error stating that the stored audio is unavailable. The user can go back, open the original YouTube link, or edit/regenerate the MP3. A failed player must not silently navigate away or clear the stored URL.

## Accessibility and Responsive Behavior

- Buttons have Vietnamese accessible labels describing their action and item.
- The detail heading identifies the selected item.
- Keyboard focus moves to the detail heading or back button when the detail opens.
- The six-category row remains a single row down to the application's supported mobile width.
- The detail view and audio player fit within the content column without horizontal page overflow.

## Verification

Automated component tests will cover these user-visible behaviors:

1. The category selector exposes six controls in a non-wrapping six-column container.
2. A list containing an item with `audio_url` does not render an audio element in the list.
3. Pressing **Nghe** opens the detail view and renders exactly one audio player for that item.
4. Pressing **Quay lại** restores the list and its active filters.
5. An item without `audio_url` shows **Thêm MP3**, which opens its edit form.

The production build must pass after implementation. A mobile-width visual check must confirm that the category selector remains one row and that list cards no longer contain embedded players.
