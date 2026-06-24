# Reviews System Report

## Customer Reviews
- Customers can submit product reviews.
- Customers can submit general site reviews.
- Customer image upload is disabled by design.
- Reviews are created as pending and do not appear publicly until approved.

## Admin Reviews
- Admin can add reviews with images.
- Admin can approve, reject, hide, feature, and archive reviews.
- Admin-only images remain supported.

## Functions
- `submit-review` handles public review submissions with rate limiting.
- `studio-reviews` handles moderation and admin updates.
