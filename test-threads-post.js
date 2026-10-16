const token = "THAAY73Jj8A65BYllsZAmhqTkhOX3l4UkVNckVUNGQybnhia0x5aVdjSExMYTRRcm81ZAHBUMjZANWWVxWDdPOW5kSGhFcUM1QzNJWVg2dDNlWWZArTEZA0ZAV94dGhmMlI4aWlKRTdjZA3BVXy1idGJuYjJkY2tGMkZA2cEdBeTJGaFV2eERYQkZAHeV9LOTZANV1VVQ0EZD";
const userId = "29211358321781466";

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function postToThreads() {
  const content = "【システム連携完了】暮らしを整える道具箱のアカウント連携テストが完了しました🌿 快適なペットとの暮らしと時短になる便利アイテムの情報をこれから発信していきます✨";
  
  console.log("Step 1: Creating Threads media container...");
  const createContainerUrl = `https://graph.threads.net/v1.0/${userId}/threads`;
  const containerParams = new URLSearchParams({
    media_type: 'TEXT',
    text: content,
    access_token: token,
  });

  const createRes = await fetch(createContainerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: containerParams.toString(),
  });

  const createData = await createRes.json();
  console.log("Container Response:", createData);

  if (!createRes.ok || !createData.id) {
    console.error("Failed to create container:", createData);
    return;
  }

  const creationId = createData.id;
  console.log("Creation ID:", creationId);

  // Wait 3 seconds for Meta internal replication
  console.log("Waiting 3 seconds for Meta propagation...");
  await sleep(3000);

  console.log("Step 2: Publishing thread...");
  const publishUrl = `https://graph.threads.net/v1.0/${userId}/threads_publish`;
  const publishParams = new URLSearchParams({
    creation_id: creationId,
    access_token: token,
  });

  for (let attempt = 1; attempt <= 3; attempt++) {
    console.log(`Publish attempt #${attempt}...`);
    const publishRes = await fetch(publishUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: publishParams.toString(),
    });

    const publishData = await publishRes.json();
    console.log("Publish Response:", publishData);

    if (publishRes.ok && publishData.id) {
      console.log(`\n🎉🎉🎉 POST SUCCESSFUL! Post ID: ${publishData.id}`);
      console.log(`URL: https://www.threads.net/post/${publishData.id}`);
      return;
    }

    if (publishData.error?.error_subcode === 4279009) {
      console.log("Propagation lag detected, waiting 2 seconds before retry...");
      await sleep(2000);
    } else {
      break;
    }
  }
}

postToThreads();
