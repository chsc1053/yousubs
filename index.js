require("dotenv").config();
const fs = require("fs");
const util = require("util");
const axios = require("axios");
const express = require("express");
const favicon = require("serve-favicon");
const bodyParser = require("body-parser");

const RapidAPI_Key = process.env.RapidAPI_Key;

if (!RapidAPI_Key) {
  console.error("ERROR: API_KEY environment variable is not set");
}

const readFileAsync = util.promisify(fs.readFile);

async function get_channel_list() {
  try {
    const data = await readFileAsync("channels.json", "utf8");
    console.log(
      "get_channel_list(): JSON fetched from channels.json:\n",
      JSON.parse(data),
      "\n"
    );
    return JSON.parse(data);
  } catch (err) {
    console.error("get_channel_list(): ERROR reading channels.json: ", err);
    return -1;
  }
}

async function update_channel_list(channels) {
  channels_without_videos = channels.map((channel) => {
    return { name: channel.name, id: channel.id };
  });
  fs.writeFile(
    "channels.json",
    JSON.stringify(channels_without_videos, null, 2),
    "utf8",
    (err) => {
      if (err) {
        console.error(
          "update_channel_list(): ERROR writing to channels.json: ",
          err
        );
        return -1;
      }
      console.log(
        "update_channel_list(): Channel list updated successfully.\n"
      );
    }
  );
}

async function get_channel_id(channel_name) {
  const options = {
    method: "GET",
    url: "https://youtube-v2.p.rapidapi.com/channel/id",
    params: {
      channel_name: channel_name,
    },
    headers: {
      "X-RapidAPI-Key": RapidAPI_Key,
      "X-RapidAPI-Host": "youtube-v2.p.rapidapi.com",
    },
  };

  try {
    const response = await axios.request(options);
    console.log(
      "get_channel_id(",
      channel_name,
      "): Response details:\n    requests-remaining : ",
      response.headers["x-ratelimit-requests-remaining"],
      "\n    ratelimit-request-reset : ",
      response.headers["x-ratelimit-requests-reset"],
      "\n    status: ",
      response.status,
      "\n"
    );
    if (response.status == 200) {
      return response.data;
    } else {
      console.log(
        "get_channel_id(",
        channel_name,
        "): ERROR fetching channel id: ",
        response.data.detail
      );
    }
  } catch (error) {
    console.error(
      "get_channel_id(",
      channel_name,
      "): ERROR fetching channel id: ",
      error
    );
    return -1;
  }
  return -1;
}

async function get_channel_ids_and_store(channels) {
  channel_list_updated = false;
  for await (const channel of channels) {
    if (channel.id === "") {
      try {
        await new Promise((resolve) => setTimeout(resolve, 1001)); // Delay for 1 second
        const get_channel_id_response = await get_channel_id(channel.name);
        if (get_channel_id_response) {
          console.log(
            "get_channel_ids_and_store(): Channel ID of",
            get_channel_id_response.channel_name,
            "is",
            get_channel_id_response.channel_id,
            "\n"
          );
          channel.id = get_channel_id_response.channel_id;
          channel_list_updated = true;
        }
      } catch (error) {
        console.error(
          "get_channel_ids_and_store(): ERROR getting channel ID of",
          channel.name,
          ":",
          error
        );
      }
    }
  }
  if (channel_list_updated) {
    update_channel_list(channels);
  }
  // console.log("get_channel_ids_and_store(): channels:\n", channels);
}

async function get_channel_videos(channel) {
  const options = {
    method: "GET",
    url: "https://youtube-v2.p.rapidapi.com/channel/videos",
    params: {
      channel_id: channel.id,
    },
    headers: {
      "X-RapidAPI-Key": RapidAPI_Key,
      "X-RapidAPI-Host": "youtube-v2.p.rapidapi.com",
    },
  };

  try {
    const response = await axios.request(options);
    // console.log(response);
    console.log(
      "get_channel_videos(",
      channel.name,
      "): Response details:\n    requests-remaining : ",
      response.headers["x-ratelimit-requests-remaining"],
      "\n    ratelimit-request-reset : ",
      response.headers["x-ratelimit-requests-reset"],
      "\n    status: ",
      response.status,
      "\n"
    );
    if (response.status == 200) {
      videos = [];
      for (const video of response.data.videos) {
        videos.push({
          id: video.video_id,
          title: video.title,
          length: video.video_length,
          published_time: video.published_time,
          thumbnail_url: video.thumbnails[3].url,
        });
      }
      return videos;
    } else {
      console.log(
        "get_channel_videos(",
        channel.name,
        "): ERROR fetching channel videos: ",
        response.data
      );
    }
  } catch (error) {
    console.error(
      "get_channel_videos(",
      channel.name,
      "): ERROR fetching channel videos: ",
      error
    );
    return -1;
  }
  return -1;
}

async function get_channel_videos_and_store(channels) {
  for await (const channel of channels) {
    try {
      await new Promise((resolve) => setTimeout(resolve, 1001)); // Delay for 1 second
      const get_channel_videos_response = await get_channel_videos(channel);
      if (get_channel_videos_response) {
        // console.log(
        //   "get_channel_videos_and_store(): Videos of",
        //   channel.name,
        //   ":",
        //   get_channel_videos_response,
        //   "\n"
        // );
        console.log(
          "get_channel_videos_and_store(): Videos of",
          channel.name,
          "fetched successfully.\n"
        );
        channel.videos = get_channel_videos_response;
      }
    } catch (error) {
      console.error(
        "get_channel_videos_and_store(): ERROR getting videos of",
        channel.name,
        ":",
        error
      );
    }
  }
  // console.log("get_channel_videos_and_store(): channels:\n", channels);
}

channels = [];

async function get_complete_video_data() {
  channels = await get_channel_list();
  await get_channel_ids_and_store(channels);
  await get_channel_videos_and_store(channels);
  // console.log("get_complete_video_data(): channels:\n", channels);
}

const app = express();

app.set("view engine", "ejs");

app.use(bodyParser.json());

app.use(express.static("public"));

app.use(favicon(__dirname + "/public/favicon.png"));

app.get("/", async (req, res) => {
  await get_complete_video_data();
  res.render("index", { channels });
});

app.get("/edit_channel_list", (req, res) => {
  res.render("edit_channel_list", { channels });
});

app.post("/add_channel", (req, res) => {
  const channel_name = req.body.channel_name;
  channels.push({ name: channel_name, id: "" });
  console.log("/add_channel: Channel", channel_name, "added to channel list.");
  update_channel_list(channels);
  // res.redirect("/edit_channel_list");
});

app.post("/remove_channel", (req, res) => {
  const channel_name = req.body.channel_name;
  channels = channels.filter((channel) => channel.name !== channel_name);
  console.log(
    "/remove_channel: Channel",
    channel_name,
    "removed from channel list."
  );
  update_channel_list(channels);
  // res.redirect("/edit_channel_list");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
