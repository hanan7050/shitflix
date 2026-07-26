const { makeProviders, makeStandardFetcher, targets } = require('@movie-web/providers');
const fetch = require('node-fetch');

async function test() {
  const fetcher = makeStandardFetcher(fetch);
  const providers = makeProviders({
    fetcher,
    target: targets.NATIVE
  });

  // List all available sources
  const sourceList = providers.listSources();
  console.log("Available sources:", sourceList.map(s => s.id));

  const embedList = providers.listEmbeds();
  console.log("Available embeds:", embedList.map(e => e.id));

  // Test with a well-known movie (Deadpool - TMDB 533535)
  const media = {
    type: 'movie',
    title: 'Deadpool & Wolverine',
    releaseYear: 2024,
    tmdbId: '533535',
    imdbId: 'tt6263850'
  };

  console.log("\n--- Testing ALL providers for Deadpool & Wolverine ---\n");

  // Try runAll without sourceOrder to let it try everything
  try {
    const output = await providers.runAll({
      media: media,
    });

    if (output) {
      console.log("\n=== SUCCESS! Stream found ===");
      console.log("Source ID:", output.sourceId);
      console.log("Embed ID:", output.embedId);
      if (output.stream) {
        output.stream.forEach((s, i) => {
          console.log(`Stream ${i}:`, {
            type: s.type,
            id: s.id,
            playlist: s.playlist ? s.playlist.substring(0, 120) + '...' : 'N/A',
            qualities: s.qualities ? Object.keys(s.qualities) : 'N/A'
          });
        });
      }
    } else {
      console.log("runAll returned null - no streams found from any provider");
    }
  } catch (err) {
    console.error("runAll error:", err.message);
  }
}

test();
