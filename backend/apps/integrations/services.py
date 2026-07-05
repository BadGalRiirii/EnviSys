"""Google Drive / Docs server-side integration (Objective 16, Scope item 3).

EnviSys links to documents hosted on Google Workspace rather than storing
files itself. This module wraps the Drive API for:
- creating one Drive folder per thesis group, and
- creating blank Google Docs inside a group's folder.

All functions require the acting user to have completed the OAuth flow
(see views.py). If Google credentials are not configured in the
environment, callers receive a clear error instead of a crash.
"""
from django.conf import settings


class GoogleNotConfigured(Exception):
    pass


def _build_drive(credential):
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build

    creds = Credentials(
        token=credential.token,
        refresh_token=credential.refresh_token or None,
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET,
        token_uri="https://oauth2.googleapis.com/token",
        scopes=settings.GOOGLE_OAUTH_SCOPES,
    )
    return build("drive", "v3", credentials=creds)


def ensure_group_folder(credential, group) -> str:
    """Create (once) and return the Drive folder ID for a thesis group."""
    if not settings.GOOGLE_CLIENT_ID:
        raise GoogleNotConfigured("Google integration is not configured on this server.")
    if group.drive_folder_id:
        return group.drive_folder_id

    drive = _build_drive(credential)
    metadata = {
        "name": f"EnviSys — {group.name}",
        "mimeType": "application/vnd.google-apps.folder",
    }
    if settings.GOOGLE_DRIVE_ROOT_FOLDER_ID:
        metadata["parents"] = [settings.GOOGLE_DRIVE_ROOT_FOLDER_ID]
    folder = drive.files().create(body=metadata, fields="id, webViewLink").execute()

    group.drive_folder_id = folder["id"]
    group.drive_folder_link = folder.get("webViewLink", "")
    group.save(update_fields=["drive_folder_id", "drive_folder_link"])
    return group.drive_folder_id


def create_google_doc(credential, group, title: str) -> dict:
    """Create a blank Google Doc inside the group's folder; return id + link."""
    folder_id = ensure_group_folder(credential, group)
    drive = _build_drive(credential)
    doc = (
        drive.files()
        .create(
            body={
                "name": title,
                "mimeType": "application/vnd.google-apps.document",
                "parents": [folder_id],
            },
            fields="id, webViewLink",
        )
        .execute()
    )
    return {"drive_file_id": doc["id"], "drive_link": doc["webViewLink"]}
