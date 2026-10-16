const token = process.env.THREADS_ACCESS_TOKEN || "THAAY73Jj8A65BYllsZAmhqTkhOX3l4UkVNckVUNGQybnhia0x5aVdjSExMYTRRcm81ZAHBUMjZANWWVxWDdPOW5kSGhFcUM1QzNJWVg2dDNlWWZArTEZA0ZAV94dGhmMlI4aWlKRTdjZA3BVXy1idGJuYjJkY2tGMkZA2cEdBeTJGaFV2eERYQkZAHeV9LOTZANV1VVQ0EZD";

async function checkThreads() {
  console.log("Checking Threads API user profile...");
  try {
    const res = await fetch(`https://graph.threads.net/v1.0/me?fields=id,username,name,threads_profile_picture_url&access_token=${token}`);
    const data = await res.json();
    console.log("Response:", JSON.stringify(data, null, 2));
    if (data.id) {
      console.log(`SUCCESS! Threads User ID: ${data.id}, Username: ${data.username}`);
    } else {
      console.error("Failed to get profile:", data);
    }
  } catch (err) {
    console.error("Network error:", err);
  }
}

checkThreads();
