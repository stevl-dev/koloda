import {
  failLessonDataLoadAtom,
  failLessonPrepareAtom,
  filtersFromRequest,
  initializeLessonAtom,
  lessonIsOpenAtom,
  lessonPhaseAtom,
  lessonRequestAtom,
  lessonSetupAtom,
  lessonUploadHeadAtom,
  receiveLessonDataAtom,
  settleLessonUploadAtom,
  submitLessonSetupAtom,
} from "@koloda/srs-react/lesson-state";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAtomValue, useSetAtom } from "jotai";
import { useEffect, useEffectEvent } from "react";
import { useMobileQueries } from "../host/queries-context";

// Copied from `libs/srs-react/src/lib/lessons/use-lesson-session.ts` and `lesson-uploader.tsx`.
// It reads the host's queries from context instead of `queriesAtom`, has no hotkey scopes,
// and submits the default amounts as soon as setup is ready, since the spike has no setup screen.
// INVARIANT: mount once, from the lesson screen; a second mount duplicates the queries and the uploader.
export function useMobileLessonSession() {
  const phase = useAtomValue(lessonPhaseAtom);
  const request = useAtomValue(lessonRequestAtom);
  const setup = useAtomValue(lessonSetupAtom);
  const isOpen = useAtomValue(lessonIsOpenAtom);
  const initialize = useSetAtom(initializeLessonAtom);
  const submitSetup = useSetAtom(submitLessonSetupAtom);
  const receiveLessonData = useSetAtom(receiveLessonDataAtom);
  const failLessonDataLoad = useSetAtom(failLessonDataLoadAtom);
  const failLessonPrepare = useSetAtom(failLessonPrepareAtom);
  const { getSettingsQuery, getTodayReviewTotalsQuery, getLessonsQuery, getLessonDataQuery } = useMobileQueries();

  const filters = request ? filtersFromRequest(request) : undefined;
  const learningSettings = useQuery(getSettingsQuery("learning"));
  const todayReviewTotals = useQuery({ ...getTodayReviewTotalsQuery(), enabled: isOpen });
  const lessons = useQuery({ ...getLessonsQuery(filters), enabled: isOpen && !!filters });
  const lessonData = useQuery({
    ...getLessonDataQuery({
      amounts: setup?.amounts ?? { untouched: 0, learn: 0, review: 0, total: 0 },
      filters: setup?.filters ?? { deckIds: [] },
    }),
    enabled: phase === "loading-cards" && !!setup,
    // WHY: the session keeps the first result, so a cached entry would replay an old snapshot on reopen.
    gcTime: 0,
  });

  const isFetchingPrepare = learningSettings.isFetching || lessons.isFetching || todayReviewTotals.isFetching;
  const prepareError = [learningSettings, lessons, todayReviewTotals].find((query) => query.isError)?.error;

  useEffect(() => {
    if (phase !== "preparing" || isFetchingPrepare || !prepareError) return;
    failLessonPrepare(prepareError);
  }, [phase, isFetchingPrepare, prepareError, failLessonPrepare]);

  useEffect(() => {
    if (phase !== "preparing" || !request || isFetchingPrepare) return;
    if (!learningSettings.isFetched || !lessons.data || !todayReviewTotals.data) return;
    initialize({
      request,
      learnAheadLimit: learningSettings.data?.content.learnAheadLimit,
      lessons: lessons.data,
      todayReviewTotals: todayReviewTotals.data,
    });
  }, [
    phase,
    request,
    isFetchingPrepare,
    learningSettings.isFetched,
    learningSettings.data,
    lessons.data,
    todayReviewTotals.data,
    initialize,
  ]);

  useEffect(() => {
    if (phase === "configuring") submitSetup();
  }, [phase, submitSetup]);

  useEffect(() => {
    if (phase !== "loading-cards" || !lessonData.isSuccess) return;
    receiveLessonData(lessonData.data ?? null);
  }, [phase, lessonData.isSuccess, lessonData.data, receiveLessonData]);

  useEffect(() => {
    if (phase !== "loading-cards" || !lessonData.isError || lessonData.isFetching) return;
    failLessonDataLoad(lessonData.error);
  }, [phase, lessonData.isError, lessonData.isFetching, lessonData.error, failLessonDataLoad]);

  useLessonUploader();
}

function useLessonUploader() {
  const result = useAtomValue(lessonUploadHeadAtom);
  const settle = useSetAtom(settleLessonUploadAtom);
  const { submitLessonResultMutation } = useMobileQueries();
  const { mutate } = useMutation(submitLessonResultMutation());

  const upload = useEffectEvent((index: number | undefined) => {
    if (index === undefined || !result || index !== result.index) return;
    mutate(
      { card: result.card, review: result.review },
      {
        onSuccess: () => settle({ index, status: "success" }),
        onError: () => settle({ index, status: "error" }),
      },
    );
  });

  useEffect(() => {
    upload(result?.index);
  }, [result?.index]); // oxlint-disable-line react/exhaustive-deps
}
