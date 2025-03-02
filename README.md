
  

# WatchMe: Live Watch Together Video App

  

WatchMe is a web-based "Watch Together" app that allows users to watch videos online together in real-time. It is built using:

  

-  **Backend**: Node.js, Express.js

-  **Frontend**: React.js (Vite)

-  **Video Support**: Supports various video formats such as mkv, mp4, and more.

-  **Chat**: A cool live chat feature with a custom emoji system.

  

This app includes the following folders:

-  **watchme-client**: The client-side code.

-  **watchme-server**: The server-side code.

  It works by turning given video url to a m3u8  stream video so it can support all kinds of video types.

## Table of Contents

  

- [Installation](#installation)

- [Configuration](#configuration)

- [Running the Server](#running-the-server)

- [Frontend Configuration](#frontend-configuration)

- [Required Dependencies](#required-dependencies)

- [FFmpeg Installation](#ffmpeg-installation)

- [Usage](#usage)

- [License](#license)

  

---

  

## Installation

  

To get started with WatchMe, you will need to install dependencies for both the client-side and server-side.

  

### 1. Server-Side Setup

1. Navigate to the `watchme-server` folder.

```bash

cd watchme-server

```

2. Install server-side dependencies using npm.

```bash

npm install

```

3. After the dependencies are installed, you can start the server.

```bash

node index.js

```

This will run the backend server.

  

### 2. Client-Side Setup

1. Navigate to the `watchme-client` folder.

```bash

cd watchme-client

```

2. Install client-side dependencies using npm.

```bash

npm install

```

  

---

  

## Configuration

  

### Server-Side Configuration (`watchme-server/index.js`)

  

- **cors origin and serverUrl**: Modify the `CORS` origin if required. This will define which domains are allowed to interact with your server.

```javascript

const  serverUrl  =  'http://localhost:5000'

const  io  =  socketIo(server, {
	cors: { origin: ['http://localhost:5173'] } // Client-Side url
});

```

  

- **Server URL**: Modify the server URL for any additional configuration needs in the server-side `index.js` file.

  

### Client-Side Configuration (`watchme-client/config.js`)

  

- **Host URL**: Set the server URL in the client-side configuration. This ensures the frontend can communicate with the server.

```javascript

export  const  config  = {
host:  "http://167.172.61.249:5000", // Replace with your server's URL (e.g., http://localhost:5000)
customEmojis: {
	':moshaliHappy:':  '/emojis/moshaliHappy.png',
	':moshali:':  '/emojis/moshali.png',
	':moshaliCryin:':  '/emojis/moshaliCryin.png',
	':cute:':  '/emojis/cute1.png',
	':huh:':  '/emojis/huh1.png',
	':ow:':  '/emojis/ow.gif',
	':dancin:':  '/emojis/dancin.gif',
	':chillin:':  '/emojis/chillin.gif',
	}
};

```

  

- **Custom Emojis**: You can also define your custom emojis in the `customEmojis` like the way I defined them.

  

---

  

## Required Dependencies

  

The following dependencies are required to run the app:

  

- **Node.js**: Make sure Node.js is installed. You can download it from [here](https://nodejs.org/).

- **FFmpeg**: FFmpeg is required for processing and streaming video content.

  

### Installing FFmpeg

  

#### 1. Windows

  

1. Download FFmpeg from the [official website](https://ffmpeg.org/download.html).

2. Extract the files to a directory of your choice.

3. Add the directory to your system's PATH environment variable:

- Right-click on **This PC** or **My Computer**, select **Properties**.

- Click on **Advanced system settings**, then **Environment Variables**.

- In the **System Variables** section, find and edit the `Path` variable.

- Add the path to the folder where FFmpeg is located (e.g., `C:fmpegin`).

- Click **OK** to save and close.

  

#### 2. macOS

  

1. Install Homebrew (if not already installed) from [https://brew.sh/](https://brew.sh/).

2. Use Homebrew to install FFmpeg:

```bash

brew install ffmpeg

```

  

#### 3. Linux (Ubuntu/Debian)

  

1. Open the terminal and run:

```bash

sudo apt update

sudo apt install ffmpeg

```

  

---

  

## Usage

  

Once you have everything set up, simply start the backend and frontend servers.

  

1. **Start the Server** (in `watchme-server` directory):

```bash

node index.js

```

  

2. **Start the Client** (in `watchme-client` directory):

```bash

npm run dev

```

  

Now you should be able to open the app in your browser and begin using WatchMe to watch videos together with others in real-time!

  

---
Thank you for using WatchMe! Enjoy watching videos together with friends and family. Dont't forget to start the project if it helped you or you liked it.