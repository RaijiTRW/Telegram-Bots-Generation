"use client";

import { useEffect } from "react";

export function RestaurantLandingKinetics() {
  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;

    if (reducedMotion || coarsePointer) {
      return;
    }

    let cleanup: (() => void) | undefined;

    async function run() {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
      ]);

      gsap.registerPlugin(ScrollTrigger);

      const context = gsap.context(() => {
        gsap.utils.toArray<HTMLElement>("[data-kinetic='media']").forEach((element) => {
          gsap.fromTo(
            element,
            { y: 34 },
            {
              y: -34,
              ease: "none",
              scrollTrigger: {
                trigger: element,
                start: "top bottom",
                end: "bottom top",
                scrub: 0.65,
              },
            },
          );
        });

        gsap.utils.toArray<HTMLElement>("[data-kinetic='soft']").forEach((element) => {
          gsap.fromTo(
            element,
            { y: 22 },
            {
              y: -22,
              ease: "none",
              scrollTrigger: {
                trigger: element,
                start: "top bottom",
                end: "bottom top",
                scrub: 0.8,
              },
            },
          );
        });
      });

      cleanup = () => context.revert();
    }

    void run();

    return () => {
      cleanup?.();
    };
  }, []);

  return null;
}
