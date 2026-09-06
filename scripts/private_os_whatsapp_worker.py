#!/usr/bin/env python3
"""Private OS WhatsApp on-demand worker.

Runs locally next to the paired Baileys session. The Founder OS dashboard queues
sync/history/stop requests in Supabase; this worker starts the WhatsApp bridge
only temporarily, imports new live events for tracked contacts, processes queued
WhatsApp actions, then stops the bridge again.
"""
from __future__ import annotations

import argparse
import json
import os
import signal
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path('/opt/data')
KEY_FILE = ROOT / 'env.brandary_supabase' / 'supabase_keys.txt'
BRIDGE_DIR = ROOT / 'scripts' / 'whatsapp-bridge'
SESSION_DIR = ROOT / 'whatsapp' / 'session'
DEFAULT_PORT = int(os.environ.get('PRIVATE_OS_WHATSAPP_BRIDGE_PORT', '3012'))
DEFAULT_DURATION = int(os.environ.get('PRIVATE_OS_WHATSAPP_SYNC_SECONDS', '45'))


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        if not line or line.startswith('#') or '=' not in line:
            continue
        k, v = line.split('=', 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


class Supabase:
    def __init__(self):
        load_env_file(KEY_FILE)
        self.url = os.environ.get('SUPABASE_URL', '').rstrip('/')
        self.key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY') or os.environ.get('SUPABASE_ANON_KEY')
        if not self.url or not self.key:
            raise RuntimeError('SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY fehlen')
        self.base_headers = {
            'apikey': self.key,
            'Authorization': f'Bearer {self.key}',
            'Content-Type': 'application/json',
        }

    def request(self, method: str, path: str, body: Any = None, extra_headers: dict[str, str] | None = None) -> Any:
        data = None if body is None else json.dumps(body).encode()
        headers = dict(self.base_headers)
        if extra_headers:
            headers.update(extra_headers)
        req = urllib.request.Request(f'{self.url}/rest/v1/{path}', data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                raw = r.read().decode()
                if not raw:
                    return None
                return json.loads(raw)
        except urllib.error.HTTPError as e:
            raw = e.read().decode(errors='replace')
            raise RuntimeError(f'{method} {path} -> HTTP {e.code}: {raw[:500]}') from e

    def select(self, table: str, query: str) -> Any:
        return self.request('GET', f'{table}?{query}')

    def patch(self, table: str, filters: str, body: dict[str, Any], returning: bool = False) -> Any:
        headers = {'Prefer': 'return=representation' if returning else 'return=minimal'}
        return self.request('PATCH', f'{table}?{filters}', body, headers)

    def insert(self, table: str, body: dict[str, Any], returning: bool = True) -> Any:
        headers = {'Prefer': 'return=representation' if returning else 'return=minimal'}
        return self.request('POST', table, body, headers)

    def upsert(self, table: str, body: dict[str, Any], conflict: str) -> dict[str, Any]:
        q = f'{table}?on_conflict={urllib.parse.quote(conflict, safe=",")}'
        headers = {'Prefer': 'resolution=merge-duplicates,return=representation'}
        rows = self.request('POST', q, body, headers)
        if not rows:
            raise RuntimeError(f'upsert {table} returned no row')
        return rows[0]


def bridge_pids() -> list[int]:
    try:
        out = subprocess.check_output(['pgrep', '-f', 'node bridge.js.*whatsapp/session'], text=True, stderr=subprocess.DEVNULL)
    except subprocess.CalledProcessError:
        return []
    return [int(x) for x in out.split() if x.strip().isdigit() and int(x) != os.getpid()]


def stop_bridge() -> int:
    count = 0
    for pid in bridge_pids():
        try:
            os.kill(pid, signal.SIGTERM)
            count += 1
        except ProcessLookupError:
            pass
    time.sleep(1)
    for pid in bridge_pids():
        try:
            os.kill(pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
    return count


def http_json(method: str, url: str, body: Any = None, timeout: int = 8) -> Any:
    data = None if body is None else json.dumps(body).encode()
    headers = {'Content-Type': 'application/json'} if body is not None else {}
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        raw = r.read().decode()
        return json.loads(raw) if raw else None


def start_bridge(port: int) -> subprocess.Popen[str]:
    stop_bridge()
    env = os.environ.copy()
    env.update({
        'WHATSAPP_MODE': 'bot',
        'WHATSAPP_DM_POLICY': 'open',
        'WHATSAPP_GROUP_POLICY': 'open',
        'WHATSAPP_ALLOWED_USERS': '*',
        'WHATSAPP_FORWARD_OWNER_MESSAGES': 'true',
        'WHATSAPP_SEND_READ_RECEIPTS': 'false',
        'WHATSAPP_REPLY_PREFIX': '',
    })
    return subprocess.Popen(
        ['node', 'bridge.js', '--session', str(SESSION_DIR), '--port', str(port), '--mode', 'bot'],
        cwd=str(BRIDGE_DIR), env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        text=True, start_new_session=True,
    )


def wait_connected(port: int, timeout_s: int = 25) -> dict[str, Any]:
    deadline = time.time() + timeout_s
    last: dict[str, Any] = {'status': 'starting'}
    while time.time() < deadline:
        try:
            last = http_json('GET', f'http://127.0.0.1:{port}/health', timeout=3)
            if last.get('status') == 'connected':
                return last
        except Exception:
            pass
        time.sleep(1)
    return last


def get_online_privacy(port: int) -> str | None:
    """Read the current 'online' visibility setting, if the bridge exposes it.

    Returns None (rather than guessing) when the setting can't be read, so the
    caller never restores a made-up default.
    """
    try:
        data = http_json('GET', f'http://127.0.0.1:{port}/privacy', timeout=8)
        settings = (data or {}).get('settings') or {}
        return settings.get('online')
    except Exception:
        return None


def set_online_privacy(port: int, value: str) -> bool:
    try:
        http_json('POST', f'http://127.0.0.1:{port}/privacy/online', {'value': value}, timeout=8)
        return True
    except Exception:
        return False


def event_time(event: dict[str, Any]) -> str:
    ts: Any = event.get('timestamp')
    try:
        if isinstance(ts, dict) and 'low' in ts:
            ts = ts.get('low')
        if ts is not None and not isinstance(ts, dict):
            val = float(ts)
            if val > 10_000_000_000:
                val = val / 1000
            return datetime.fromtimestamp(val, timezone.utc).isoformat()
    except Exception:
        pass
    return utc_now()


def upsert_event(sb: Supabase, event: dict[str, Any], store_untracked: bool = False, include_groups: bool = False) -> str:
    chat_id = event.get('chatId') or ''
    sender_id = event.get('senderId') or chat_id
    if not chat_id or not event.get('messageId'):
        return 'skipped_malformed'
    if chat_id.endswith('@broadcast') or 'status@broadcast' in chat_id:
        return 'skipped_status'
    is_group = bool(event.get('isGroup')) or chat_id.endswith('@g.us')
    if is_group and not include_groups:
        return 'skipped_group'
    direction = 'outbound' if event.get('fromOwner') else 'inbound'
    contact_provider_id = chat_id if not is_group else sender_id
    display = event.get('senderName') or event.get('chatName') or contact_provider_id.split('@')[0]

    contact = sb.upsert('private_os_contacts', {
        'provider': 'whatsapp',
        'provider_contact_id': contact_provider_id,
        'display_name': display,
        'username': contact_provider_id.split('@')[0],
        'metadata': {'last_chat_id': chat_id, 'is_group_sender': is_group},
    }, 'provider,provider_contact_id')

    if not contact.get('is_tracked') and not store_untracked:
        return 'skipped_untracked'

    thread = sb.upsert('private_os_threads', {
        'provider': 'whatsapp',
        'contact_id': contact['id'],
        'provider_thread_id': chat_id,
        'title': event.get('chatName') or display,
        'is_group': is_group,
        'last_message_at': event_time(event),
        'last_message_text': event.get('body') or ('[' + str(event.get('mediaType') or 'Medium') + ']'),
        'metadata': {'chat_id': chat_id},
    }, 'provider,provider_thread_id')

    media = []
    if event.get('hasMedia') or event.get('mediaUrls'):
        media.append({
            'type': event.get('mediaType'), 'mime': event.get('mime'),
            'file_name': event.get('fileName'), 'urls': event.get('mediaUrls') or [],
            'native': event.get('nativeMetadata') or {},
        })

    try:
        sb.upsert('private_os_messages', {
            'provider': 'whatsapp',
            'thread_id': thread['id'],
            'contact_id': contact['id'],
            'provider_message_id': event['messageId'],
            'direction': direction,
            'sender_provider_id': sender_id,
            'sender_name': event.get('senderName'),
            'body_text': event.get('body') or None,
            'media': media,
            'raw': event,
            'received_at': event_time(event),
        }, 'provider,provider_message_id')
    except RuntimeError as exc:
        if 'duplicate key' not in str(exc):
            raise
        return 'duplicate'

    # Keep thread preview fresh after message upsert.
    sb.patch('private_os_threads', f'id=eq.{thread["id"]}', {
        'last_message_at': event_time(event),
        'last_message_text': event.get('body') or ('[' + str(event.get('mediaType') or 'Medium') + ']'),
        'updated_at': utc_now(),
    })
    return 'stored'


def process_actions(sb: Supabase, port: int, limit: int = 25) -> dict[str, int]:
    rows = sb.select('private_os_message_actions', 'provider=eq.whatsapp&status=eq.queued&order=queued_at.asc&limit=' + str(limit))
    stats = {'processed': 0, 'done': 0, 'error': 0}
    for action in rows or []:
        stats['processed'] += 1
        aid = action['id']
        try:
            sb.patch('private_os_message_actions', f'id=eq.{aid}', {'status': 'processing'})
            if action['action'] == 'delete_local':
                mid = action.get('message_id')
                if mid:
                    sb.patch('private_os_messages', f'id=eq.{mid}', {'local_deleted_at': utc_now()})
                sb.patch('private_os_message_actions', f'id=eq.{aid}', {'status': 'done', 'processed_at': utc_now()})
                stats['done'] += 1
                continue
            if action['action'] == 'delete_remote':
                raise RuntimeError('WhatsApp remote delete ist in der Bridge noch nicht sicher implementiert; lokal ausblenden bleibt verfügbar.')
            if action['action'] != 'reply':
                raise RuntimeError(f'unsupported WhatsApp action: {action["action"]}')
            thread_rows = sb.select('private_os_threads', f'id=eq.{action["thread_id"]}&select=provider_thread_id&limit=1')
            if not thread_rows:
                raise RuntimeError('thread not found')
            text = (action.get('payload') or {}).get('body_text')
            if not text:
                raise RuntimeError('body_text missing')
            sent = http_json('POST', f'http://127.0.0.1:{port}/send', {'chatId': thread_rows[0]['provider_thread_id'], 'message': text}, timeout=20)
            sb.patch('private_os_message_actions', f'id=eq.{aid}', {'status': 'done', 'processed_at': utc_now(), 'payload': {**(action.get('payload') or {}), 'send_result': sent}})
            stats['done'] += 1
        except Exception as exc:
            sb.patch('private_os_message_actions', f'id=eq.{aid}', {'status': 'error', 'error': str(exc)[:500], 'processed_at': utc_now()})
            stats['error'] += 1
    return stats


def handle_run(sb: Supabase, run: dict[str, Any], port: int) -> dict[str, Any]:
    rid = run['id']
    action = run.get('action') or 'sync'
    params = run.get('params') or {}
    if action == 'stop':
        stopped = stop_bridge()
        result = {'stopped_processes': stopped, 'bridge_running': bool(bridge_pids())}
        sb.patch('private_os_whatsapp_sync_runs', f'id=eq.{rid}', {'status': 'done', 'started_at': utc_now(), 'finished_at': utc_now(), 'result': result})
        return result

    duration = int(params.get('duration_seconds') or DEFAULT_DURATION)
    duration = max(10, min(duration, 180))
    store_untracked = bool(params.get('store_untracked'))
    include_groups = bool(params.get('include_groups'))
    history_days = int(params.get('history_days') or (2 if action == 'history_sync' else 0))

    sb.patch('private_os_whatsapp_sync_runs', f'id=eq.{rid}', {'status': 'running', 'started_at': utc_now(), 'result': {'bridge': 'starting'}})
    proc = start_bridge(port)
    result: dict[str, Any] = {'mode': action, 'duration_seconds': duration, 'history_days_requested': history_days, 'bridge_health': None, 'events': 0, 'stored': 0, 'skipped': {}, 'actions': {}}
    original_online_privacy: str | None = None
    privacy_hidden = False
    try:
        health = wait_connected(port)
        result['bridge_health'] = health
        if health.get('status') != 'connected':
            raise RuntimeError(f'WhatsApp bridge connected nicht: {health}')

        # Hide online-status for the duration of this sync window only.
        # Read the real current value first — never assume a default — so we
        # restore exactly what the user had configured, not a guess.
        original_online_privacy = get_online_privacy(port)
        result['online_privacy_before'] = original_online_privacy
        if original_online_privacy is not None:
            privacy_hidden = set_online_privacy(port, 'match_last_seen')
            result['online_privacy_hidden'] = privacy_hidden
        else:
            result['online_privacy_hidden'] = False
            result['online_privacy_note'] = 'Privacy-Setting konnte nicht gelesen werden; Online-Status wurde nicht verändert (safe default: nichts raten).'

        if action == 'history_sync':
            # Baileys/Hermes bridge exposes live queue endpoints only. This run keeps
            # the naming explicit and records that true retro-history is experimental.
            result['history_note'] = 'Bridge hat keinen stabilen /history Endpoint; sammle Live-/Push-Events während des Fensters und filtere danach.'
        deadline = time.time() + duration
        while time.time() < deadline:
            try:
                events = http_json('GET', f'http://127.0.0.1:{port}/messages', timeout=8) or []
            except Exception:
                events = []
            for ev in events:
                result['events'] += 1
                outcome = upsert_event(sb, ev, store_untracked=store_untracked, include_groups=include_groups)
                if outcome == 'stored':
                    result['stored'] += 1
                elif outcome == 'duplicate':
                    result['skipped']['duplicate'] = result['skipped'].get('duplicate', 0) + 1
                else:
                    result['skipped'][outcome] = result['skipped'].get(outcome, 0) + 1
            time.sleep(3)
        # Flush once more.
        try:
            for ev in http_json('GET', f'http://127.0.0.1:{port}/messages', timeout=8) or []:
                result['events'] += 1
                outcome = upsert_event(sb, ev, store_untracked=store_untracked, include_groups=include_groups)
                if outcome == 'stored': result['stored'] += 1
                else: result['skipped'][outcome] = result['skipped'].get(outcome, 0) + 1
        except Exception:
            pass
        result['actions'] = process_actions(sb, port)
        sb.patch('private_os_whatsapp_sync_runs', f'id=eq.{rid}', {'status': 'done', 'finished_at': utc_now(), 'result': result})
        return result
    except Exception as exc:
        result['error'] = str(exc)[:500]
        sb.patch('private_os_whatsapp_sync_runs', f'id=eq.{rid}', {'status': 'error', 'finished_at': utc_now(), 'result': result, 'error': str(exc)[:500]})
        raise
    finally:
        # Restore the user's original online-visibility before the bridge
        # goes away — this must run even if the sync itself failed above.
        if privacy_hidden and original_online_privacy is not None:
            try:
                restored = set_online_privacy(port, original_online_privacy)
                result['online_privacy_restored'] = restored
                result['online_privacy_restored_to'] = original_online_privacy
            except Exception as restore_exc:
                result['online_privacy_restore_error'] = str(restore_exc)[:300]
        try:
            proc.terminate()
            proc.wait(timeout=5)
        except Exception:
            try:
                proc.kill()
            except Exception:
                pass
        stop_bridge()
        # Persist the final privacy-restore outcome even on the error path,
        # where the earlier except-block already wrote result without it.
        try:
            sb.patch('private_os_whatsapp_sync_runs', f'id=eq.{rid}', {'result': result})
        except Exception:
            pass


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--once', action='store_true')
    ap.add_argument('--status', action='store_true')
    ap.add_argument('--port', type=int, default=DEFAULT_PORT)
    args = ap.parse_args()
    sb = Supabase()
    if args.status:
        latest = sb.select('private_os_whatsapp_sync_runs', 'order=queued_at.desc&limit=1')
        print(json.dumps({'bridge_running': bool(bridge_pids()), 'latest_run': latest[0] if latest else None}, ensure_ascii=False, indent=2))
        return 0
    rows = sb.select('private_os_whatsapp_sync_runs', 'status=eq.queued&order=queued_at.asc&limit=1')
    if not rows:
        # Also process local-only actions only if the bridge is already up; don't wake WhatsApp for accidental action polling.
        return 0
    result = handle_run(sb, rows[0], args.port)
    # Non-empty output only when real user-triggered work happened.
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(json.dumps({'error': str(exc)[:500]}, ensure_ascii=False), file=sys.stderr)
        raise
