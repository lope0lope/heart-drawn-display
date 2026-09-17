# Capture Page Readability Update

## Changes
- Rename the visible **Slot** field to **Pen**, including its validation message.
- Exclude condition entries whose code or name is **KK** or **Malnourish/Malnourished** from the capture picker, including offline-cached lists.
- Give the standalone capture page a daylight-friendly white theme with black text, stronger borders, and accessible dark accent colors.
- Preserve the existing dark theme everywhere outside the capture URL.

## Verification
- Check the capture page at tablet and phone widths.
- Confirm the removed conditions do not appear and the form still saves entries.
