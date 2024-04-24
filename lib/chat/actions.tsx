import 'server-only'

import {
  createAI,
  createStreamableUI,
  getMutableAIState,
  getAIState,
  render,
  createStreamableValue
} from 'ai/rsc'
import OpenAI from 'openai'
import {
  spinner,
  BotCard,
  BotMessage,
  SystemMessage,
  Stock,
  Purchase
} from '@/components/stocks'

import { z } from 'zod'
import { EventsSkeleton } from '@/components/stocks/events-skeleton'
import { Events } from '@/components/stocks/events'
import { StocksSkeleton } from '@/components/stocks/stocks-skeleton'
import { Stocks } from '@/components/stocks/stocks'
import { StockSkeleton } from '@/components/stocks/stock-skeleton'
import {
  formatNumber,
  runAsyncFnWithoutBlocking,
  sleep,
  nanoid
} from '@/lib/utils'
import { saveChat } from '@/app/actions'
import { SpinnerMessage, UserMessage } from '@/components/stocks/message'
import { Chat } from '@/lib/types'
import { auth } from '@/auth'
import { User, UserLeagues } from '../schema'
import rostersJson from '../rosters.json'
import { use } from 'react'
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''
})

const userIdToRosterIdMap: Record<string, string> = {}

async function confirmPurchase(symbol: string, price: number, amount: number) {
  'use server'

  const aiState = getMutableAIState<typeof AI>()

  const purchasing = createStreamableUI(
    <div className="inline-flex items-start gap-1 md:items-center">
      {spinner}
      <p className="mb-2">
        Purchasing {amount} ${symbol}...
      </p>
    </div>
  )

  const systemMessage = createStreamableUI(null)

  runAsyncFnWithoutBlocking(async () => {
    await sleep(1000)

    purchasing.update(
      <div className="inline-flex items-start gap-1 md:items-center">
        {spinner}
        <p className="mb-2">
          Purchasing {amount} ${symbol}... working on it...
        </p>
      </div>
    )

    await sleep(1000)

    purchasing.done(
      <div>
        <p className="mb-2">
          You have successfully purchased {amount} ${symbol}. Total cost:{' '}
          {formatNumber(amount * price)}
        </p>
      </div>
    )

    systemMessage.done(
      <SystemMessage>
        You have purchased {amount} shares of {symbol} at ${price}. Total cost ={' '}
        {formatNumber(amount * price)}.
      </SystemMessage>
    )

    aiState.done({
      ...aiState.get(),
      messages: [
        ...aiState.get().messages.slice(0, -1),
        {
          id: nanoid(),
          role: 'function',
          name: 'showStockPurchase',
          content: JSON.stringify({
            symbol,
            price,
            defaultAmount: amount,
            status: 'completed'
          })
        },
        {
          id: nanoid(),
          role: 'system',
          content: `[User has purchased ${amount} shares of ${symbol} at ${price}. Total cost = ${
            amount * price
          }]`
        }
      ]
    })
  })

  return {
    purchasingUI: purchasing.value,
    newMessage: {
      id: nanoid(),
      display: systemMessage.value
    }
  }
}

async function submitUserMessage(content: string) {
  'use server'

  const aiState = getMutableAIState<typeof AI>()

  aiState.update({
    ...aiState.get(),
    messages: [
      ...aiState.get().messages,
      {
        id: nanoid(),
        role: 'user',
        content
      }
    ]
  })

  let textStream: undefined | ReturnType<typeof createStreamableValue<string>>
  let textNode: undefined | React.ReactNode

  const ui = render({
    model: 'gpt-3.5-turbo',
    provider: openai,
    initial: <SpinnerMessage />,
    messages: [
      {
        role: 'system',
        content: `\
You are a fantasy sports conversation bot using the Sleeper platform. You can assist users in managing their fantasy leagues, exploring league details, and understanding player statistics.

Messages inside [] denote UI elements or user events. For example:
- "[League Name: Fantasy Champions]" indicates that the league name 'Fantasy Champions' is displayed to the user.
- "[User has set their draft position to 5]" means that the user has adjusted their draft position to 5 in the UI.

The user must provide their username before you can do anything. You must ask the user for their username before you can do anything.
If the user requests details themselves call \`getUserInfo\` to fetch and display the league information. You can get the user's id from this response.
If the user wants detailed information about a specific league, call \`getAllUserLeaguesAndDetails\` to show more comprehensive data. You'll need the users id to get the league information.
If the user wants to see the league details of a specific league, call \`getIndividualLeagueDetails\` to show the league information. You'll need the league id to get the league information.
If the user wants to see the rosters of all teams in a league, call \`getLeagueRosters\` to show the league information. You'll need the league id to get the league information.
If the user wants an individual roster you can ask them for a username, and get their roster id. You can then call \`getUserRosterByRosterId\` to show the roster information.

Remember you can deduce which roster is the current users roster by looking at the roster id.

The users team id and roster id are the same. You can use the team id to get the roster id.
If the user attempts to perform an action not supported by the bot, respond that this is a demo and the requested action cannot be completed.

Additionally, you can engage in general chat with users and provide calculations or comparisons as needed based on league data.`
      },
      ...aiState.get().messages.map((message: any) => ({
        role: message.role,
        content: message.content,
        name: message.name
      }))
    ],
    text: ({ content, done, delta }) => {
      if (!textStream) {
        textStream = createStreamableValue('')
        textNode = <BotMessage content={textStream.value} />
      }

      if (done) {
        textStream.done()
        aiState.done({
          ...aiState.get(),
          messages: [
            ...aiState.get().messages,
            {
              id: nanoid(),
              role: 'assistant',
              content
            }
          ]
        })
      } else {
        textStream.update(delta)
      }

      return textNode
    },
    functions: {
      getUserInfo: {
        description:
          'Retrieve the user information and their leagues. The username is a string, mostly letters and numbers.',
        parameters: z.object({
          username: z.string().describe('Username of the user')
        }),
        render: async function* ({ username }) {
          yield (
            <BotCard>
              <SpinnerMessage />
            </BotCard>
          )

          const userInfo: User = await fetch(
            `https://api.sleeper.app/v1/user/${username}`
          ).then(res => res.json())

          console.log({ userInfo })

          const userLeagues: UserLeagues = await fetch(
            `https://api.sleeper.app/v1/user/${userInfo.user_id}/leagues/nfl/2023`
          ).then(res => res.json())

          console.log({ userLeagues })

          aiState.done({
            ...aiState.get(),
            messages: [
              ...aiState.get().messages,
              {
                id: nanoid(),
                role: 'function',
                name: 'getUserInfo',
                content: JSON.stringify({ userInfo, userLeagues })
              }
            ]
          })

          return (
            <BotCard>
              {userInfo.user_id && (
                <div className="p-4">
                  <div className="flex items-center mb-4 space-x-2">
                    <img
                      src={`https://sleepercdn.com/avatars/${userInfo.avatar}`}
                      alt="User Avatar"
                      className="w-16 h-16 rounded-full mr-4"
                    />
                    <div>
                      <h3 className="text-xl font-semibold">
                        {userInfo.display_name}
                      </h3>
                      <p className="text-gray-500">@{userInfo.username}</p>
                    </div>
                  </div>
                  <div className="mb-4">
                    <p>
                      <strong>Email:</strong> {userInfo.email}
                    </p>
                    <p>
                      <strong>User ID:</strong> {userInfo.user_id}
                    </p>
                    <p>
                      <strong>Is Bot:</strong> {userInfo.is_bot ? 'Yes' : 'No'}
                    </p>
                  </div>
                  {userInfo.summoner_name && (
                    <div className="mb-4">
                      <p>
                        <strong>Summoner Name:</strong> {userInfo.summoner_name}
                      </p>
                      <p>
                        <strong>Summoner Region:</strong>{' '}
                        {userInfo.summoner_region}
                      </p>
                    </div>
                  )}
                  {userLeagues.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-lg font-semibold">Leagues:</h4>
                      <ul>
                        {userLeagues.map(league => (
                          <li key={league.league_id}>
                            {league.name} - {league.season}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </BotCard>
          )
        }
      },
      getAllUserLeaguesAndDetails: {
        description:
          'Retrieve details of a specific league using its ID. the league id is mostly numbers, and usually almost always numbers',
        parameters: z.object({
          user_id: z.string().describe('User ID of the user'),
          sport: z.string().describe('Type of sport, e.g., NFL'),
          season: z.string().describe('Year of the season')
        }),
        render: async function* ({ user_id, sport, season }) {
          yield (
            <BotCard>
              <SpinnerMessage />
            </BotCard>
          )

          const response: UserLeagues = await fetch(
            `https://api.sleeper.app/v1/user/${user_id}/leagues/nfl/2023`
          ).then(res => res.json())

          const leagues = response || []

          console.log({ leagues })

          aiState.done({
            ...aiState.get(),
            messages: [
              ...aiState.get().messages,
              {
                id: nanoid(),
                role: 'function',
                name: 'getAllUserLeaguesAndDetails',
                content: JSON.stringify(leagues)
              }
            ]
          })

          return (
            <BotCard>
              {leagues.length > 0 ? (
                <div className="p-4">
                  <h3 className="text-xl font-semibold mb-2">Your Leagues</h3>
                  <ul className="space-y-2">
                    {leagues.map(league => (
                      <li
                        key={league.league_id}
                        className="bg-gray-100 p-2 rounded"
                      >
                        <div>
                          <strong>Name:</strong> {league.name}
                        </div>
                        <div>
                          <strong>Sport:</strong> {league.sport}
                        </div>
                        <div>
                          <strong>Season:</strong> {league.season}
                        </div>
                        <div>
                          <strong>Status:</strong> {league.status}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </BotCard>
          )
        }
      },
      getIndividualLeagueDetails: {
        description:
          'Retrieve detailed information of an individual league using its league ID.',
        parameters: z.object({
          league_id: z.string().describe('League ID of the specific league')
        }),
        render: async function* ({ league_id }) {
          yield (
            <BotCard>
              <SpinnerMessage />
            </BotCard>
          )

          const leagueDetails = await fetch(
            `https://api.sleeper.app/v1/league/${league_id}`
          ).then(res => res.json())

          const leagueRosters = await fetch(
            `https://api.sleeper.app/v1/league/${league_id}/rosters`
          ).then(res => res.json())

          //populate the roster map
          leagueRosters.forEach(roster => {
            console.log(roster.roster_id, roster.owner_id)
            userIdToRosterIdMap[roster.roster_id] = roster.owner_id
          })

          console.log({ leagueRosters })

          aiState.done({
            ...aiState.get(),
            messages: [
              ...aiState.get().messages,
              {
                id: nanoid(),
                role: 'function',
                name: 'getIndividualLeagueDetails',
                content: JSON.stringify(leagueDetails)
              }
            ]
          })

          return (
            <BotCard>
              <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg shadow">
                <div className="flex items-center mb-4">
                  <img
                    src={`https://sleepercdn.com/avatars/${leagueDetails.avatar}`}
                    alt="League Avatar"
                    className="w-16 h-16 rounded-full mr-4"
                  />
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                    League Details
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <p>
                    <strong>Name:</strong> {leagueDetails.name}
                  </p>
                  <p>
                    <strong>Type:</strong> {leagueDetails.type}
                  </p>
                  <p>
                    <strong>Status:</strong> {leagueDetails.status}
                  </p>
                  <p>
                    <strong>Sport:</strong> {leagueDetails.sport}
                  </p>
                  <p>
                    <strong>Season:</strong> {leagueDetails.season}
                  </p>
                  <p>
                    <strong>Number of Teams:</strong>{' '}
                    {leagueDetails.settings.num_teams}
                  </p>
                  <p>
                    <strong>Scoring Type:</strong>{' '}
                    {leagueDetails.settings.waiver_type === 1
                      ? 'Standard'
                      : 'PPR'}
                  </p>
                  <p>
                    <strong>Positions:</strong>{' '}
                    {leagueDetails.roster_positions.join(', ')}
                  </p>
                </div>
                <div className="mt-4">
                  <h4 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">
                    Scoring Settings
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <p>
                      <strong>Passing Yards:</strong>{' '}
                      {Number(leagueDetails.scoring_settings.pass_yd).toFixed(
                        3
                      )}{' '}
                      per yard
                    </p>
                    <p>
                      <strong>Rushing Yards:</strong>{' '}
                      {Number(leagueDetails.scoring_settings.rush_yd).toFixed(
                        3
                      )}{' '}
                      per yard
                    </p>
                    <p>
                      <strong>Receiving Yards:</strong>{' '}
                      {Number(leagueDetails.scoring_settings.rec_yd).toFixed(3)}{' '}
                      per yard
                    </p>
                    <p>
                      <strong>Passing TDs:</strong>{' '}
                      {Number(leagueDetails.scoring_settings.pass_td).toFixed(
                        3
                      )}{' '}
                      points
                    </p>
                    <p>
                      <strong>Rushing TDs:</strong>{' '}
                      {Number(leagueDetails.scoring_settings.rush_td).toFixed(
                        3
                      )}{' '}
                      points
                    </p>
                    <p>
                      <strong>Receiving TDs:</strong>{' '}
                      {Number(leagueDetails.scoring_settings.rec_td).toFixed(3)}{' '}
                      points
                    </p>
                    <p>
                      <strong>Interceptions:</strong>{' '}
                      {Number(leagueDetails.scoring_settings.int).toFixed(3)}{' '}
                      points
                    </p>
                    <p>
                      <strong>Fumbles Lost:</strong>{' '}
                      {Number(leagueDetails.scoring_settings.fum_lost).toFixed(
                        3
                      )}{' '}
                      points
                    </p>
                  </div>
                </div>
              </div>
            </BotCard>
          )
        }
      },
      getUserRosterByRosterId: {
        description:
          'Retrieve the rosters of all teams in a league, given the roster id',
        parameters: z.object({
          league_id: z.string().describe('League ID of the specific league'),
          roster_id: z.string().describe('Roster ID of the specific roster'),
          owner_id: z.string().describe('User ID of the owner of the roster')
        }),
        render: async function* ({ league_id, roster_id, owner_id }) {
          yield (
            <BotCard>
              <SpinnerMessage />
            </BotCard>
          )
          console.log(`Fetching rosters for league_id: ${league_id}`)
          const leagueRosters = await fetch(
            `https://api.sleeper.app/v1/league/${league_id}/rosters`
          ).then(res => res.json())
          console.log(`Rosters received: ${JSON.stringify(leagueRosters)}`)

          // //get the roster id from the global map
          // console.log(userIdToRosterIdMap)

          // const userRoster = leagueRosters.find(
          //   (roster: { roster_id: number }) =>
          //     roster.roster_id.toString() === userIdToRosterIdMap[roster_id]
          // )
          // console.log(`User roster found`)
          // console.log({ userRoster })

          const userRoster = leagueRosters.find(
            roster => roster.owner_id.toString() === owner_id
          )
          console.log(`User roster filtered by owner ID: ${owner_id}`)

          if (!userRoster) {
            console.error(`No roster found for roster_id: ${roster_id}`)
            return (
              <BotCard>
                <div className="p-4 bg-red-100 dark:bg-red-800 rounded-lg shadow">
                  <h3 className="text-xl font-semibold mb-4 text-red-900 dark:text-red-200">
                    Error
                  </h3>
                  <p>Roster not found for the provided ID.</p>
                </div>
              </BotCard>
            )
          }

          const userPlayers = userRoster.players.map((playerId: string) => {
            const playerDetails = rostersJson[playerId]
            return {
              id: playerId,
              name: playerDetails
                ? `${playerDetails.first_name} ${playerDetails.last_name}`
                : 'Unknown Player',
              position: playerDetails
                ? playerDetails.position
                : 'Unknown Position',
              team: playerDetails ? playerDetails.team : 'Free Agent'
            }
          })

          console.log({ userRoster, userPlayers })

          return (
            <BotCard>
              <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg shadow">
                <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                  Roster
                </h3>
                <ul className="space-y-2">
                  {userPlayers.map(
                    (
                      player: {
                        id: string
                        name: string
                        position: string
                        team: string
                      },
                      index: number
                    ) => (
                      <li
                        key={index}
                        className="bg-gray-200 dark:bg-gray-700 p-2 rounded"
                      >
                        <p>
                          <strong>Player ID:</strong> {player.id}
                        </p>
                        <p>
                          <strong>Name:</strong> {player.name}
                        </p>
                        <p>
                          <strong>Position:</strong> {player.position}
                        </p>
                        <p>
                          <strong>Team:</strong> {player.team}
                        </p>
                      </li>
                    )
                  )}
                </ul>
              </div>
            </BotCard>
          )
        }
      }
    }
  })

  return {
    id: nanoid(),
    display: ui
  }
}

export type Message = {
  role: 'user' | 'assistant' | 'system' | 'function' | 'data' | 'tool'
  content: string
  id: string
  name?: string
}

export type AIState = {
  chatId: string
  messages: Message[]
}

export type UIState = {
  id: string
  display: React.ReactNode
}[]

export const AI = createAI<AIState, UIState>({
  actions: {
    submitUserMessage,
    confirmPurchase
  },
  initialUIState: [],
  initialAIState: { chatId: nanoid(), messages: [] },
  unstable_onGetUIState: async () => {
    'use server'

    const session = await auth()

    if (session && session.user) {
      const aiState = getAIState()

      if (aiState) {
        const uiState = getUIStateFromAIState(aiState)
        return uiState
      }
    } else {
      return
    }
  },
  unstable_onSetAIState: async ({ state, done }) => {
    'use server'

    // const session = await auth()

    // if (session && session.user) {
    //   const { chatId, messages } = state

    //   const createdAt = new Date()
    //   const userId = session.user.id as string
    //   const path = `/chat/${chatId}`
    //   const title = messages[0].content.substring(0, 100)

    //   const chat: Chat = {
    //     id: chatId,
    //     title,
    //     userId,
    //     createdAt,
    //     messages,
    //     path
    //   }

    //   await saveChat(chat)
    // } else {
    //   return
    // }
  }
})

export const getUIStateFromAIState = (aiState: Chat) => {}
