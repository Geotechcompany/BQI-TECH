"use client";



import {

  createContext,

  useCallback,

  useContext,

  useMemo,

  useRef,

  useState,

  type ReactNode,

} from "react";

import { createPortal } from "react-dom";

import { driver, type Driver } from "driver.js";

import "driver.js/dist/driver.css";

import "./tour-styles.css";

import {

  dismissTour,

  getTourById,

  isTourDismissed,

  isTourSnoozed,

  snoozeTour,

} from "@/lib/admin-tours";

import { getTourHeroImage } from "@/lib/admin-tour-heroes";

import type { TourStep } from "@/lib/admin-tours/types";

import {

  buildDriveStep,

  enhanceTourPopover,

  isStepAvailable,

} from "./TourTooltip";

import { TourWelcomeModal } from "./TourWelcomeModal";



export interface PlatformTourContextValue {

  activeTourId: string | null;

  currentStepIndex: number;

  totalSteps: number;

  isRunning: boolean;

  startTour: (tourId: string, fromStep?: number) => void;

  stopTour: () => void;

  restartTour: () => void;

  snoozeActiveTour: () => void;

  dismissActiveTour: () => void;

  isTourDismissed: (tourId: string) => boolean;

  isTourSnoozed: (tourId: string) => boolean;

}



const PlatformTourContext = createContext<PlatformTourContextValue | null>(null);



function findNextAvailableStep(steps: TourStep[], fromIndex: number): number {

  for (let index = fromIndex; index < steps.length; index += 1) {

    if (isStepAvailable(steps[index])) {

      return index;

    }

  }

  return -1;

}



export function PlatformTourProvider({ children }: { children: ReactNode }) {

  const driverRef = useRef<Driver | null>(null);

  const activeTourIdRef = useRef<string | null>(null);

  const tourStepsRef = useRef<TourStep[]>([]);

  const brandHeroRef = useRef(false);

  const heroImageSrcRef = useRef<string | undefined>(undefined);

  const [activeTourId, setActiveTourId] = useState<string | null>(null);

  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const [totalSteps, setTotalSteps] = useState(0);

  const [isRunning, setIsRunning] = useState(false);

  const [modalStep, setModalStep] = useState<TourStep | null>(null);



  const cleanupDriver = useCallback(() => {

    if (driverRef.current?.isActive()) {

      driverRef.current.destroy();

    }

    driverRef.current = null;

  }, []);



  const cleanupTour = useCallback(() => {

    cleanupDriver();

    activeTourIdRef.current = null;

    tourStepsRef.current = [];

    brandHeroRef.current = false;

    heroImageSrcRef.current = undefined;

    setActiveTourId(null);

    setCurrentStepIndex(0);

    setTotalSteps(0);

    setIsRunning(false);

    setModalStep(null);

  }, [cleanupDriver]);



  const showSpotlightStep = useCallback(

    (tourId: string, stepIndex: number, steps: TourStep[], step: TourStep) => {

      cleanupDriver();

      setModalStep(null);



      const driverInstance = driver({

        animate: true,

        smoothScroll: true,

        allowClose: true,

        allowKeyboardControl: true,

        overlayColor: "#272055",

        overlayOpacity: 0.68,

        stagePadding: 10,

        stageRadius: 12,

        popoverClass: "bqi-tour-popover",

        showButtons: [],

        showProgress: false,

        onCloseClick: () => {

          snoozeTour(tourId);

          cleanupTour();

        },

        steps: [buildDriveStep(step)],

        onPopoverRender: (popover, opts) => {

          enhanceTourPopover({

            popover,

            stepIndex,

            totalSteps: steps.length,

            showBrandHero: brandHeroRef.current,

            coverSrc: heroImageSrcRef.current,

            onRestart: () => {

              opts.driver.destroy();

              const firstIndex = findNextAvailableStep(steps, 0);

              if (firstIndex >= 0) {

                runTourStepRef.current?.(tourId, firstIndex, steps);

              }

            },

            onSnooze: () => {

              snoozeTour(tourId);

              cleanupTour();

            },

            onClose: () => {

              snoozeTour(tourId);

              cleanupTour();

            },

            onNext: () => {

              opts.driver.destroy();

              if (stepIndex >= steps.length - 1) {

                dismissTour(tourId);

                cleanupTour();

                return;

              }



              const nextIndex = findNextAvailableStep(steps, stepIndex + 1);

              if (nextIndex < 0) {

                dismissTour(tourId);

                cleanupTour();

                return;

              }



              runTourStepRef.current?.(tourId, nextIndex, steps);

            },

          });

        },

        onDestroyed: () => {

          driverRef.current = null;

        },

      });



      driverRef.current = driverInstance;

      driverInstance.drive();

    },

    [cleanupDriver, cleanupTour]

  );



  const runTourStepRef = useRef<

    ((tourId: string, stepIndex: number, steps: TourStep[]) => void) | null

  >(null);



  const runTourStep = useCallback(

    (tourId: string, stepIndex: number, steps: TourStep[]) => {

      const availableIndex = findNextAvailableStep(steps, stepIndex);

      if (availableIndex < 0) {

        dismissTour(tourId);

        cleanupTour();

        return;

      }



      const step = steps[availableIndex];

      activeTourIdRef.current = tourId;

      tourStepsRef.current = steps;

      setActiveTourId(tourId);

      setCurrentStepIndex(availableIndex);

      setTotalSteps(steps.length);

      setIsRunning(true);



      if (step.type === "modal") {

        cleanupDriver();

        setModalStep(step);

        return;

      }



      showSpotlightStep(tourId, availableIndex, steps, step);

    },

    [cleanupDriver, cleanupTour, showSpotlightStep]

  );



  runTourStepRef.current = runTourStep;



  const startTour = useCallback(

    (tourId: string, fromStep = 0) => {

      const definition = getTourById(tourId);

      if (!definition) {

        console.warn(`[PlatformTour] Unknown tour: ${tourId}`);

        return;

      }



      const steps = definition.steps;

      const firstIndex = findNextAvailableStep(steps, fromStep);

      if (firstIndex < 0) {

        console.warn(

          `[PlatformTour] No available steps for tour "${tourId}". Add data-tour attributes.`

        );

        return;

      }



      cleanupTour();

      brandHeroRef.current = Boolean(definition.brandHero);

      heroImageSrcRef.current =
        definition.heroImageSrc ?? getTourHeroImage(tourId);

      runTourStep(tourId, firstIndex, steps);

    },

    [cleanupTour, runTourStep]

  );



  const stopTour = useCallback(() => {

    cleanupTour();

  }, [cleanupTour]);



  const restartTour = useCallback(() => {

    const tourId = activeTourIdRef.current ?? activeTourId;

    if (tourId) {

      startTour(tourId, 0);

    }

  }, [activeTourId, startTour]);



  const snoozeActiveTour = useCallback(() => {

    const tourId = activeTourIdRef.current ?? activeTourId;

    if (tourId) {

      snoozeTour(tourId);

    }

    cleanupTour();

  }, [activeTourId, cleanupTour]);



  const dismissActiveTour = useCallback(() => {

    const tourId = activeTourIdRef.current ?? activeTourId;

    if (tourId) {

      dismissTour(tourId);

    }

    cleanupTour();

  }, [activeTourId, cleanupTour]);



  const handleModalNext = useCallback(() => {

    const tourId = activeTourIdRef.current;

    const steps = tourStepsRef.current;

    if (!tourId || steps.length === 0) {

      cleanupTour();

      return;

    }



    if (currentStepIndex >= steps.length - 1) {

      dismissTour(tourId);

      cleanupTour();

      return;

    }



    const nextIndex = findNextAvailableStep(steps, currentStepIndex + 1);

    if (nextIndex < 0) {

      dismissTour(tourId);

      cleanupTour();

      return;

    }



    runTourStep(tourId, nextIndex, steps);

  }, [cleanupTour, currentStepIndex, runTourStep]);



  const value = useMemo<PlatformTourContextValue>(

    () => ({

      activeTourId,

      currentStepIndex,

      totalSteps,

      isRunning,

      startTour,

      stopTour,

      restartTour,

      snoozeActiveTour,

      dismissActiveTour,

      isTourDismissed,

      isTourSnoozed,

    }),

    [

      activeTourId,

      currentStepIndex,

      totalSteps,

      isRunning,

      startTour,

      stopTour,

      restartTour,

      snoozeActiveTour,

      dismissActiveTour,

    ]

  );



  return (

    <PlatformTourContext.Provider value={value}>

      {children}

      {modalStep && typeof document !== "undefined"

        ? createPortal(

            <TourWelcomeModal

              step={modalStep}

              stepIndex={currentStepIndex}

              totalSteps={totalSteps}

              coverSrc={heroImageSrcRef.current}

              onSnooze={snoozeActiveTour}

              onClose={snoozeActiveTour}

              onNext={handleModalNext}

              onRestart={restartTour}

            />,

            document.body

          )

        : null}

    </PlatformTourContext.Provider>

  );

}



export function usePlatformTourContext(): PlatformTourContextValue {

  const context = useContext(PlatformTourContext);

  if (!context) {

    throw new Error("usePlatformTour must be used within PlatformTourProvider");

  }

  return context;

}



/** Re-export provider as PlatformTour for layout imports. */

export { PlatformTourProvider as PlatformTour };

