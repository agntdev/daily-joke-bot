# Daily Joke Bot — Bot specification

**Archetype:** content

A Telegram bot delivering random jokes on demand and a single daily broadcast joke at a fixed time. Users can request jokes anytime, subscribe/unsubscribe from broadcasts, and receive text-only jokes with admin delivery reports.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- Casual Telegram users seeking humor
- Individuals wanting quick text jokes

## Success criteria

- Daily broadcast delivered to all subscribed users at 09:00 UTC
- On-demand /joke command returns random joke
- Admin receives daily delivery summary with metrics

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Display welcome message with bot features and subscription status
- **/joke** (command, actor: user, command: /joke) — Send random joke immediately
- **/subscribe** (command, actor: user, command: /subscribe) — Explicitly confirm broadcast subscription
- **/unsubscribe** (command, actor: user, command: /unsubscribe) — Opt out of daily broadcasts
- **/stop** (command, actor: user, command: /stop) — Alternative unsubscribe command

## Flows

### Daily Broadcast
_Trigger:_ 09:00 UTC daily

1. Fetch random joke from repository
2. Send 'Daily Joke' message to all unsubscribed users
3. Log delivery results

_Data touched:_ Broadcast schedule, User, Joke, Send log

### Admin Report
_Trigger:_ After daily broadcast

1. Aggregate delivery metrics
2. Send summary to admin Telegram account

_Data touched:_ Send log, User

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

- **User** _(retention: persistent)_ — Telegram user registration and subscription status
  - fields: telegram_id, display_name, opt_out_flag
- **Joke** _(retention: persistent)_ — Curated joke repository
  - fields: id, text, source, language
- **Send log** _(retention: persistent)_ — Broadcast delivery tracking
  - fields: timestamp, user_id, joke_id, send_result
- **Broadcast schedule** _(retention: persistent)_ — Daily broadcast timing configuration
  - fields: daily_time_utc

## Integrations

- **Telegram** (required) — User messaging and broadcast delivery
- **Telegram** (required) — Admin notification channel
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- Configure daily broadcast time
- Manage joke repository
- View admin delivery reports

## Notifications

- Daily joke broadcast message
- Admin delivery summary report

## Permissions & privacy

- Store user opt-out preferences indefinitely
- Send messages only to subscribed users

## Edge cases

- User unsubscribes after receiving today's broadcast
- Joke repository empty during broadcast
- Admin Telegram account configuration missing

## Required tests

- End-to-end daily broadcast flow with error logging
- Command response validation for /joke and subscription controls

## Assumptions

- Default broadcast time is 09:00 UTC
- Jokes are text-only in English
- Admin account configured at deployment
