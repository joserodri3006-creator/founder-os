#!/usr/bin/env python3
"""Private OS Instagram worker.

Syncs Instagram DM conversations into Founder OS and processes queued reply
actions. Designed for cron/manual runs: no secrets are printed, and remote
writes only happen for explicit rows in private_os_message_actions.

Required env or /opt/data/env.brandary_supabase/supabase_keys.txt:
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
Required Instagram env:
  PRIVATE_OS_INSTAGRAM_IG_USER_ID
  PRIVATE_OS_INSTAGRAM_PAGE_ACCESS_TOKEN

Optional:
  PRIVATE_OS_INSTAGRAM_API_VERSION=v21.0
  PRIVATE_OS_INSTAGRAM_SYNC_LIMIT=25
  PRIVATE_OS_STORE_UNTRACKED=false  # true stores messages before contact approval
  PRIVATE_OS_INSTAGRAM_MIRROR_INBOX=true  # mirror Blazed DMs into /inbox
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SUPABASE_KEYS = Path('/opt/data/env.brandary_supabase/supabase_keys.txt')
PROVIDER = 'instagram'


def load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, value = line.split('=', 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def json_request(method: str, url: str, *, headers: dict[str, str] | None = None, body: Any = None, timeout: int = 30) -> Any:
    payload = None
    final_headers = {'Accept': 'application/json', **(headers or {})}
    if body is not None:
        payload = json.dumps(body, ensure_ascii=False).encode('utf-8')
        final_headers['Content-Type'] = 'application/json'
    req = urllib.request.Request(url, data=payload, method=method, headers=final_headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            text = resp.read().decode('utf-8')
            return json.loads(text) if text else None
    except urllib.error.HTTPError as exc:
        text = exc.read().decode('utf-8', errors='replace')
        raise RuntimeError(f'{method} {url} failed {exc.code}: {text[:800]}') from exc


class Supabase:
    def __init__(self) -> None:
        load_dotenv(SUPABASE_KEYS)
        self.url = os.environ.get('SUPABASE_URL', '').rstrip('/')
        self.key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')
        if not self.url or not self.key:
            raise SystemExit('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
        self.headers = {
            'apikey': self.key,
            'Authorization': f'Bearer {self.key}',
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        }

    def get(self, table: str, params: dict[str, str]) -> list[dict[str, Any]]:
        qs = urllib.parse.urlencode(params, safe='(),.*')
        return json_request('GET', f'{self.url}/rest/v1/{table}?{qs}', headers=self.headers) or []

    def upsert(self, table: str, rows: list[dict[str, Any]] | dict[str, Any], on_conflict: str) -> list[dict[str, Any]]:
        headers = {**self.headers, 'Prefer': 'resolution=merge-duplicates,return=representation'}
        qs = urllib.parse.urlencode({'on_conflict': on_conflict})
        return json_request('POST', f'{self.url}/rest/v1/{table}?{qs}', headers=headers, body=rows) or []

    def insert(self, table: str, row: dict[str, Any]) -> dict[str, Any] | None:
        headers = {**self.headers, 'Prefer': 'return=representation'}
        data = json_request('POST', f'{self.url}/rest/v1/{table}', headers=headers, body=row) or []
        return data[0] if data else None

    def patch(self, table: str, filters: dict[str, str], patch: dict[str, Any]) -> list[dict[str, Any]]:
        headers = {**self.headers, 'Prefer': 'return=representation'}
        qs = urllib.parse.urlencode(filters, safe='(),.*')
        return json_request('PATCH', f'{self.url}/rest/v1/{table}?{qs}', headers=headers, body=patch) or []


def graph_get(path: str, params: dict[str, str]) -> Any:
    token = os.environ['PRIVATE_OS_INSTAGRAM_PAGE_ACCESS_TOKEN']
    version = os.environ.get('PRIVATE_OS_INSTAGRAM_API_VERSION', 'v21.0')
    qs = urllib.parse.urlencode({**params, 'access_token': token})
    return json_request('GET', f'https://graph.facebook.com/{version}/{path}?{qs}')


def graph_post(path: str, body: dict[str, Any]) -> Any:
    token = os.environ['PRIVATE_OS_INSTAGRAM_PAGE_ACCESS_TOKEN']
    version = os.environ.get('PRIVATE_OS_INSTAGRAM_API_VERSION', 'v21.0')
    qs = urllib.parse.urlencode({'access_token': token})
    return json_request('POST', f'https://graph.facebook.com/{version}/{path}?{qs}', body=body)


def participant_id(participant: dict[str, Any], own_id: str) -> str:
    return str(participant.get('id') or participant.get('username') or own_id)


def instagram_contact_address(contact_provider_id: str, username: str | None) -> str:
    handle = (username or contact_provider_id or 'unknown').strip().lower().lstrip('@')
    safe = ''.join(ch if ch.isalnum() or ch in {'_', '.', '-'} else '_' for ch in handle) or 'unknown'
    return f'{safe}@instagram.local'


def mirror_to_operational_inbox(sb: Supabase, *, account_id: str | None, ig_user_id: str, contact_provider_id: str, display_name: str, username: str | None, conv: dict[str, Any], msg: dict[str, Any], direction: str) -> None:
    attachments = msg.get('attachments', {}).get('data', []) if isinstance(msg.get('attachments'), dict) else []
    body_text = msg.get('message') or ('[Instagram-Medium]' if attachments else '')
    from_address = 'blazed@instagram.local' if direction == 'outbound' else instagram_contact_address(contact_provider_id, username)
    from_name = 'Blazed Outfitters Instagram' if direction == 'outbound' else display_name
    sb.upsert('inbox_messages', {
        'venture': 'blazed_outfitters',
        'account_id': account_id or 'blazed_instagram',
        'account_email': 'Blazed Instagram',
        'folder': 'sent' if direction == 'outbound' else 'INBOX',
        'provider': 'instagram',
        'message_uid': str(msg['id']),
        'message_id': str(msg['id']),
        'thread_key': str(conv['id']),
        'from_email': from_address,
        'from_name': from_name,
        'to_emails': ['Blazed Instagram'] if direction == 'inbound' else [instagram_contact_address(contact_provider_id, username)],
        'cc_emails': [],
        'subject': f'Instagram DM · {display_name}',
        'body_preview': body_text.replace('\n', ' ').strip()[:500] if body_text else '[Instagram-Medium]',
        'body_text': body_text or None,
        'has_attachments': bool(attachments),
        'attachment_names': ['Instagram-Medium'] if attachments else [],
        'received_at': msg.get('created_time') or now_iso(),
        'match_status': 'unmatched',
    }, 'account_email,folder,message_uid')


def sync_instagram(sb: Supabase, *, dry_run: bool = False) -> dict[str, int]:
    ig_user_id = os.environ.get('PRIVATE_OS_INSTAGRAM_IG_USER_ID')
    if not ig_user_id or not os.environ.get('PRIVATE_OS_INSTAGRAM_PAGE_ACCESS_TOKEN'):
        return {'conversations': 0, 'messages': 0, 'skipped': 0, 'error_missing_instagram_env': 1}

    limit = os.environ.get('PRIVATE_OS_INSTAGRAM_SYNC_LIMIT', '25')
    store_untracked = os.environ.get('PRIVATE_OS_STORE_UNTRACKED', 'false').lower() in {'1', 'true', 'yes', 'on'}
    mirror_inbox = os.environ.get('PRIVATE_OS_INSTAGRAM_MIRROR_INBOX', 'true').lower() in {'1', 'true', 'yes', 'on'}
    fields = 'id,updated_time,participants{id,username,name},messages.limit(25){id,message,created_time,from,to,attachments}'
    payload = graph_get(f'{ig_user_id}/conversations', {'platform': 'instagram', 'fields': fields, 'limit': limit})
    stats = {'conversations': 0, 'messages': 0, 'skipped': 0, 'error_missing_instagram_env': 0}

    account_rows = sb.upsert('private_os_accounts', {
        'provider': PROVIDER,
        'provider_account_id': ig_user_id,
        'label': 'Instagram',
        'username': None,
        'enabled': True,
        'updated_at': now_iso(),
    }, 'provider,provider_account_id') if not dry_run else [{'id': None}]
    account_id = account_rows[0].get('id') if account_rows else None

    for conv in payload.get('data', []) if isinstance(payload, dict) else []:
        participants = conv.get('participants', {}).get('data', [])
        other = next((p for p in participants if str(p.get('id')) != str(ig_user_id)), participants[0] if participants else {})
        contact_provider_id = participant_id(other, str(conv['id']))
        display_name = other.get('name') or other.get('username') or contact_provider_id
        username = other.get('username')

        contact_rows = sb.upsert('private_os_contacts', {
            'provider': PROVIDER,
            'provider_contact_id': contact_provider_id,
            'display_name': display_name,
            'username': username,
            'metadata': {'raw_participant': other},
            'updated_at': now_iso(),
        }, 'provider,provider_contact_id') if not dry_run else [{'id': None, 'is_tracked': True}]
        contact = contact_rows[0] if contact_rows else {}
        contact_id = contact.get('id')
        is_tracked = bool(contact.get('is_tracked'))

        msgs = list(reversed(conv.get('messages', {}).get('data', [])))
        last_msg = msgs[-1] if msgs else {}
        last_text = last_msg.get('message') or '[Medium]'
        last_at = last_msg.get('created_time') or conv.get('updated_time')
        if not dry_run:
            thread_rows = sb.upsert('private_os_threads', {
                'provider': PROVIDER,
                'account_id': account_id,
                'contact_id': contact_id,
                'provider_thread_id': str(conv['id']),
                'title': display_name,
                'is_group': len(participants) > 2,
                'last_message_at': last_at,
                'last_message_text': last_text,
                'metadata': {'participants': participants},
                'updated_at': now_iso(),
            }, 'provider,provider_thread_id')
            thread_id = thread_rows[0].get('id') if thread_rows else None
        else:
            thread_id = None
        stats['conversations'] += 1

        for msg in msgs:
            sender = msg.get('from') or {}
            direction = 'outbound' if str(sender.get('id')) == str(ig_user_id) else 'inbound'
            if dry_run:
                stats['messages'] += 1
                continue
            if mirror_inbox:
                mirror_to_operational_inbox(sb, account_id=account_id, ig_user_id=ig_user_id, contact_provider_id=contact_provider_id, display_name=display_name, username=username, conv=conv, msg=msg, direction=direction)
            if not is_tracked and not store_untracked:
                stats['skipped'] += 1
                continue
            sb.upsert('private_os_messages', {
                'provider': PROVIDER,
                'thread_id': thread_id,
                'contact_id': contact_id,
                'provider_message_id': str(msg['id']),
                'direction': direction,
                'sender_provider_id': sender.get('id'),
                'sender_name': sender.get('username') or sender.get('name'),
                'body_text': msg.get('message'),
                'media': msg.get('attachments', {}).get('data', []) if isinstance(msg.get('attachments'), dict) else [],
                'raw': msg,
                'sent_at': msg.get('created_time'),
                'received_at': msg.get('created_time') or now_iso(),
            }, 'provider,provider_message_id')
            stats['messages'] += 1
    return stats


def process_actions(sb: Supabase, *, dry_run: bool = False) -> dict[str, int]:
    actions = sb.get('private_os_message_actions', {
        'provider': 'eq.instagram',
        'status': 'eq.queued',
        'order': 'queued_at.asc',
        'limit': '20',
    })
    stats = {'processed': 0, 'done': 0, 'error': 0}
    for action in actions:
        stats['processed'] += 1
        try:
            if not dry_run:
                sb.patch('private_os_message_actions', {'id': f'eq.{action["id"]}'}, {'status': 'processing'})
            if action['action'] == 'reply':
                thread = sb.get('private_os_threads', {'id': f'eq.{action["thread_id"]}', 'select': 'provider_thread_id,contact_id'})[0]
                contact = sb.get('private_os_contacts', {'id': f'eq.{thread["contact_id"]}', 'select': 'provider_contact_id'})[0]
                text = (action.get('payload') or {}).get('body_text')
                if not text:
                    raise RuntimeError('reply payload body_text fehlt')
                if not dry_run:
                    graph_post('me/messages', {
                        'recipient': {'id': contact['provider_contact_id']},
                        'message': {'text': text},
                        'messaging_type': 'RESPONSE',
                    })
                    sb.insert('private_os_messages', {
                        'provider': PROVIDER,
                        'thread_id': action['thread_id'],
                        'contact_id': thread['contact_id'],
                        'provider_message_id': f'local-action-{action["id"]}',
                        'direction': 'outbound',
                        'body_text': text,
                        'received_at': now_iso(),
                        'sent_at': now_iso(),
                        'raw': {'action_id': action['id']},
                    })
            elif action['action'] == 'delete_local':
                if not dry_run:
                    sb.patch('private_os_messages', {'id': f'eq.{action["message_id"]}'}, {'local_deleted_at': now_iso()})
            elif action['action'] == 'delete_remote':
                raise RuntimeError('Instagram API unterstützt Remote-Löschen von DM-Nachrichten hier nicht zuverlässig; nur lokal ausblenden ist verfügbar.')
            else:
                raise RuntimeError(f'Nicht unterstützte Instagram-Aktion: {action["action"]}')
            if not dry_run:
                sb.patch('private_os_message_actions', {'id': f'eq.{action["id"]}'}, {'status': 'done', 'processed_at': now_iso(), 'error': None})
            stats['done'] += 1
        except Exception as exc:
            if not dry_run:
                sb.patch('private_os_message_actions', {'id': f'eq.{action["id"]}'}, {'status': 'error', 'processed_at': now_iso(), 'error': str(exc)[:1000]})
            stats['error'] += 1
    return stats


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--skip-sync', action='store_true')
    parser.add_argument('--skip-actions', action='store_true')
    args = parser.parse_args()

    sb = Supabase()
    summary: dict[str, Any] = {}
    if not args.skip_sync:
        summary['sync'] = sync_instagram(sb, dry_run=args.dry_run)
    if not args.skip_actions:
        try:
            summary['actions'] = process_actions(sb, dry_run=args.dry_run)
        except RuntimeError as exc:
            if 'private_os_message_actions' in str(exc) or 'PGRST205' in str(exc):
                summary['actions'] = {'processed': 0, 'done': 0, 'error': 0, 'error_missing_tables': 1}
            else:
                raise

    # Cron-friendly: stay quiet if no work and no setup issue.
    has_setup_issue = summary.get('sync', {}).get('error_missing_instagram_env')
    work = summary.get('sync', {}).get('messages', 0) or summary.get('actions', {}).get('processed', 0)
    if args.dry_run or has_setup_issue or work:
        print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
