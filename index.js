require("dotenv").config();
const fs = require('fs');
const axios = require('axios');
const express = require('express');
const favicon = require('serve-favicon');

const RapidAPI_Key = process.env.RapidAPI_Key;

if (!RapidAPI_Key) {
  console.error("ERROR: API_KEY environment variable is not set");
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
  for await (const channel of channels) {
    if (channel.id === "") {
      try {
        await new Promise(resolve => setTimeout(resolve, 1001)); // Delay for 1 second
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
      await new Promise(resolve => setTimeout(resolve, 1001)); // Delay for 1 second
      const get_channel_videos_response = await get_channel_videos(channel);
      if (get_channel_videos_response) {
        console.log(
          "get_channel_videos_and_store(): Videos of",
          channel.name,
          ":",
          get_channel_videos_response,
          "\n"
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

async function get_complete_video_data(channels) {
  await get_channel_ids_and_store(channels);
  await get_channel_videos_and_store(channels);
  // console.log("get_complete_video_data(): channels:\n", channels);
}

channels = [
  { name: "LinusTechTips", id: "UCXuqSBlHAE6Xw-yeJA0Tunw" },
  { name: "saradietschy", id: "UC3fg6pL63upkXCc0T203wVg" },
  { name: "mkbhd", id: "UCBJycsmduvYEL83R_U4JriQ" },
];

get_complete_video_data(channels);

const app = express();

app.set('view engine', 'ejs');

app.use(favicon(__dirname + '/public/favicon.png'));

app.use(express.static('public'));

app.get('/', (req, res) => {
  res.render('index', { channels });
});

app.get('/edit_channel_list', (req, res) => {
  res.render('edit_channel_list', { channels });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async() => {
  console.log(`Server is running on http://localhost:${PORT}`);
});