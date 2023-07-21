"use server";

import { KubeConfig, CoreV1Api } from "@kubernetes/client-node";
import { db } from "./lib/knex";
import { format, endOfWeek, startOfDay, startOfWeek } from "date-fns";
import { locale } from "./lib/date-fn-locale";

async function getPodsInfo() {
  try {
    // Load the Kubernetes configuration from the default location
    const kubeConfig = new KubeConfig();
    kubeConfig.loadFromDefault();

    // Create the Kubernetes API client
    const k8sApi = kubeConfig.makeApiClient(CoreV1Api);

    // Retrieve the list of pods in the default namespace (modify this as needed)
    const namespace = "default";
    const { body: podList } = await k8sApi.listNamespacedPod(namespace);

    // Extract relevant information from the pod list
    const podsInfo = podList.items.map((pod) => ({
      deploymentName:
        pod.metadata?.labels?.["app.kubernetes.io/instance"] || "",
      podName: pod.metadata?.name || "",
      status: pod.status?.phase || "",
    }));

    return podsInfo;
  } catch (err: any) {
    console.error("Error retrieving pods:", err.response?.body || err);
    return [];
  }
}

export type ScheduleEntry = {
  id: number;
  video: {
    id: number;
    title: string;
  };
  startsAt: Date;
  endsAt: Date;
};

const getScheduleEntries = async (
  startsAt: Date,
  endsAt: Date
): Promise<ScheduleEntry[]> => {
  const scheduleEntries = await db
    .select(
      "jukebox_entries.id",
      "jukebox_entries.starts_at",
      "videos.id as video_id",
      "videos.title as video_title",
      "video_media.duration as duration"
    )
    .select(db.raw("starts_at + duration * interval '1 second' as ends_at"))
    .from("jukebox_entries")
    .join("videos", "jukebox_entries.video_id", "videos.id")
    .join("video_media", "videos.media_id", "video_media.id")
    .whereBetween("starts_at", [startsAt, endsAt]);

  return scheduleEntries.map((entry) => ({
    id: entry.id,
    video: {
      id: entry.video_id,
      title: entry.video_title,
    },
    startsAt: entry.starts_at,
    endsAt: entry.ends_at,
  }));
};

const groupByStartOfDay = (
  scheduleEntries: ScheduleEntry[]
): Record<string, ScheduleEntry[]> =>
  scheduleEntries.reduce((acc: Record<string, ScheduleEntry[]>, entry) => {
    // Get the start of the day timestamp
    const date = format(startOfDay(entry.startsAt), "PP", { locale });

    // If the timestamp is not yet a key in the accumulator, add it with an empty array
    if (!acc[date]) acc[date] = [];

    // Push the current entry to the array associated with the timestamp
    acc[date].push(entry);

    return acc;
  }, {});

const getVideoCount = async () => {
  const [{ count }] = await db.count().from("videos");
  return count;
};

// Uses ISO week number (1-53)
const getWeekSchedule = async (weekNo: number) => {
  if (weekNo < 1 || weekNo > 53)
    throw new Error("Invalid week number, must be between 1 and 53");

  // Gets the date of the first day of the week
  const startsAt = startOfWeek(new Date(), { weekStartsOn: 1 });

  // Date at the very end of the given week
  const endsAt = endOfWeek(startsAt, { weekStartsOn: 1 });

  const weekSchedule = await getScheduleEntries(startsAt, endsAt);

  return weekSchedule;
};

export const ServersideThing = async () => {
  const pods = await getPodsInfo();
  return (
    <div>
      Spiffingly good to see you
      <div>{pods.map((pod) => pod.podName).join(", ")}</div>
      <div>{getVideoCount()} videos</div>
      <div className="flex">
        {Object.entries(groupByStartOfDay(await getWeekSchedule(24))).map(
          ([timestamp, entries]) => (
            <div>
              <div>{timestamp}</div>
              <div>
                {entries.map((entry) => (
                  <div>{entry.video.title}</div>
                ))}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
};
