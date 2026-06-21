import { sendDueDiaryReminders, type ReminderWorkerEnv } from './worker/reminders'

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore `.open-next/worker.js` is generated at build time.
import handler from './.open-next/worker.js'

type ScheduledControllerLike = {
    scheduledTime: number
}

type ExecutionContextLike = {
    waitUntil: (promise: Promise<unknown>) => void
}

const worker = {
    fetch: handler.fetch,
    scheduled(
        controller: ScheduledControllerLike,
        env: ReminderWorkerEnv,
        context: ExecutionContextLike
    ) {
        context.waitUntil(sendDueDiaryReminders(env, new Date(controller.scheduledTime)))
    },
}

export default worker
