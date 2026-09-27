import Image from "next/image";

/**
 * Asymmetric magazine grid — design spec: editorial breakout > 1280px,
 * 60/40 split, ~850px tall on desktop, unboxed artwork with slight
 * boundary crossing, no drawn grid lines, text never crossed.
 */
export function MagazineGrid() {
  return (
    <section aria-labelledby="home-editorial" className="bg-cream pt-16 pb-20">
      <h2 id="home-editorial" className="sr-only">
        Handmade with care
      </h2>

      <div className="mx-auto w-full max-w-[1400px] px-4 md:px-6 lg:px-10">
        <div className="lg:grid lg:grid-cols-[60%_40%] lg:min-h-[850px] relative">
          {/* 60% — sunflower dominant, duck tucked bottom-left */}
          <div className="relative lg:pr-6">
            <div className="relative mx-auto lg:ml-auto lg:mr-[6%] w-[82%] lg:w-[76%]">
              <Image
                src="/florals/sunflower.png"
                alt="Crochet sunflower bouquet"
                width={1031}
                height={1318}
                sizes="(min-width: 1024px) 45vw, 82vw"
                className="w-full h-auto"
              />
            </div>
            <div className="absolute -bottom-4 left-0 w-[26%] lg:w-[30%]">
              <Image
                src="/florals/duck.png"
                alt="Crochet duck keychain"
                width={470}
                height={1080}
                sizes="(min-width: 1024px) 15vw, 26vw"
                className="w-full h-auto"
              />
            </div>
          </div>

          {/* 40% — editorial copy blocks + lily */}
          <div className="relative mt-16 lg:mt-0 lg:pl-10 flex flex-col">
            <p className="font-[family-name:var(--font-display)] font-medium text-[26px] leading-[1.1] text-charcoal max-w-[260px] lg:text-[32px] lg:self-end">
              HANDMADE
              <br />
              WITH CARE
            </p>

            <div className="relative mt-10 lg:mt-auto lg:mb-10">
              <div className="w-[70%] lg:w-[78%] lg:ml-auto">
                <Image
                  src="/florals/lily.png"
                  alt="Crochet lily bouquet"
                  width={1024}
                  height={1462}
                  sizes="(min-width: 1024px) 30vw, 70vw"
                  className="w-full h-auto"
                />
              </div>
              <p className="font-body text-body text-muted mt-6 max-w-[340px] lg:ml-auto">
                Made by hand, with care in every stitch.
              </p>
            </div>

            <p className="font-[family-name:var(--font-display)] font-medium text-[24px] leading-[1.15] text-sage max-w-[340px] mt-10 lg:mt-8 lg:text-[28px] lg:self-end">
              FROM YARN&nbsp;→<br />
              SOMETHING SPECIAL
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
