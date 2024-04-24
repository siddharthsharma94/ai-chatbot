import { z } from 'zod'

const scoringSettingsSchema = z.record(z.string(), z.number())
export type ScoringSettings = z.infer<typeof scoringSettingsSchema>

const settingsSchema = z.object({
  daily_waivers_last_ran: z.number(),
  reserve_allow_cov: z.number(),
  reserve_slots: z.number(),
  leg: z.number(),
  offseason_adds: z.number(),
  bench_lock: z.number(),
  trade_review_days: z.number(),
  league_average_match: z.number(),
  waiver_type: z.number(),
  max_keepers: z.number(),
  type: z.number(),
  pick_trading: z.number(),
  disable_trades: z.number(),
  daily_waivers: z.number(),
  taxi_years: z.number(),
  trade_deadline: z.number(),
  veto_show_votes: z.number(),
  reserve_allow_sus: z.number(),
  reserve_allow_out: z.number(),
  playoff_round_type: z.number(),
  waiver_day_of_week: z.number(),
  taxi_allow_vets: z.number(),
  reserve_allow_dnr: z.number(),
  veto_auto_poll: z.number(),
  commissioner_direct_invite: z.number(),
  reserve_allow_doubtful: z.number(),
  waiver_clear_days: z.number(),
  playoff_week_start: z.number(),
  daily_waivers_days: z.number(),
  last_scored_leg: z.number(),
  taxi_slots: z.number(),
  playoff_type: z.number(),
  daily_waivers_hour: z.number(),
  num_teams: z.number(),
  squads: z.number().optional(),
  veto_votes_needed: z.number(),
  playoff_teams: z.number(),
  playoff_seed_type: z.number(),
  start_week: z.number(),
  reserve_allow_na: z.number(),
  draft_rounds: z.number(),
  taxi_deadline: z.number(),
  waiver_bid_min: z.number().optional(),
  capacity_override: z.number().optional(),
  disable_adds: z.number(),
  waiver_budget: z.number(),
  last_report: z.number(),
  best_ball: z.number()
})
export type Settings = z.infer<typeof settingsSchema>

const metadataSchema = z.object({
  trophy_winner_banner_text: z.string().optional(),
  trophy_winner_background: z.string().optional(),
  trophy_winner: z.string().optional(),
  trophy_loser_banner_text: z.string().optional(),
  trophy_loser_background: z.string().optional(),
  trophy_loser: z.string().optional(),
  latest_league_winner_roster_id: z.string().optional(),
  keeper_deadline: z.string().optional(),
  auto_continue: z.string().optional()
})
export type Metadata = z.infer<typeof metadataSchema>

const UserLeaguesSchema = z.array(
  z.object({
    total_rosters: z.number(),
    loser_bracket_id: z.number(),
    bracket_id: z.number(),
    group_id: z.number().nullable(),
    last_transaction_id: z.number(),
    roster_positions: z.array(z.string()),
    previous_league_id: z.string(),
    last_read_id: z.string(),
    league_id: z.string(),
    last_pinned_message_id: z.string(),
    draft_id: z.string(),
    last_message_time: z.number(),
    last_message_text_map: z.any().nullable(),
    last_message_attachment: z.any().nullable(),
    last_author_is_bot: z.boolean(),
    last_author_id: z.string(),
    last_author_display_name: z.string(),
    last_author_avatar: z.string().nullable(),
    display_order: z.number(),
    shard: z.number(),
    last_message_id: z.string(),
    sport: z.string(),
    season_type: z.string(),
    season: z.string(),
    scoring_settings: scoringSettingsSchema,
    company_id: z.string().nullable(),
    avatar: z.string(),
    settings: settingsSchema,
    metadata: metadataSchema,
    status: z.string(),
    name: z.string()
  })
)
export type UserLeagues = z.infer<typeof UserLeaguesSchema>

const userSchema = z.object({
  verification: z.string().nullable().optional(),
  username: z.string(),
  user_id: z.string(),
  token: z.string().nullable().optional(),
  summoner_region: z.string().nullable().optional(),
  summoner_name: z.string().nullable().optional(),
  solicitable: z.boolean().nullable().optional(),
  real_name: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  pending: z.boolean().nullable().optional(),
  notifications: z.boolean().nullable().optional(),
  metadata: z.any().nullable().optional(),
  is_bot: z.boolean(),
  email: z.string().nullable().optional(),
  display_name: z.string(),
  deleted: z.boolean().nullable().optional(),
  data_updated: z.number().nullable().optional(),
  currencies: z.array(z.string()).nullable().optional(),
  created: z.number().nullable().optional(),
  cookies: z.any().nullable().optional(),
  avatar: z.string()
})

export type User = z.infer<typeof userSchema>
