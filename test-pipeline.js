async function testPipeline() {
  console.log("=== 1. Testing GET /api/pipeline/run-automated ===");
  try {
    const getRes = await fetch("http://localhost:3001/api/pipeline/run-automated");
    const getData = await getRes.json();
    console.log("Current Mode Info:", JSON.stringify(getData, null, 2));

    console.log("\n=== 2. Testing POST /api/pipeline/run-automated (Harvest Dry-Run) ===");
    const harvestRes = await fetch("http://localhost:3001/api/pipeline/run-automated", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        forceMode: "harvest",
        genre: "pet",
        dryRun: true,
      }),
    });
    const harvestData = await harvestRes.json();
    console.log("Harvest Mode Result:", JSON.stringify({
      message: harvestData.message,
      mode: harvestData.result?.mode,
      selectedProduct: harvestData.result?.selectedProduct,
      attachedMedia: harvestData.result?.attachedMedia,
      contentSnippet: harvestData.result?.content,
      selectionReason: harvestData.highPriceStats?.selectionReason,
    }, null, 2));

    console.log("\n=== 3. Testing POST /api/pipeline/run-automated (Nurture Dry-Run) ===");
    const nurtureRes = await fetch("http://localhost:3001/api/pipeline/run-automated", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        forceMode: "nurture",
        genre: "life",
        dryRun: true,
      }),
    });
    const nurtureData = await nurtureRes.json();
    console.log("Nurture Mode Result:", JSON.stringify({
      message: nurtureData.message,
      mode: nurtureData.result?.mode,
      isNoLink: nurtureData.result?.isNoLink,
      attachedMedia: nurtureData.result?.attachedMedia,
      contentSnippet: nurtureData.result?.content,
    }, null, 2));

  } catch (err) {
    console.error("Test failed:", err);
  }
}

testPipeline();
