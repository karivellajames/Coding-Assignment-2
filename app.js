const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "twitterClone.db");
const app = express();

app.use(express.json());

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error is ${e.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();

//API 1 /register/
app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const checkUser = `SELECT username FROM user WHERE username = "${username}";`;
  const dbUser = await db.get(checkUser);

  if (dbUser !== undefined) {
    response.status(400);
    response.send("User already exists");
  } else {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      const requestQuery = `
            INSERT INTO
                user(username, password, name, gender)
            VALUES
                ("${username}", "${hashedPassword}", "${name}", "${gender}");`;
      await db.run(requestQuery);
      response.status(200);
      response.send("User created successfully");
    }
  }
});

//API 2 /login/
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const checkUser = `SELECT * FROM user WHERE username = "${username}";`;
  const dbUserExist = await db.get(checkUser);

  if (dbUserExist !== undefined) {
    const checkPassword = await bcrypt.compare(password, dbUserExist.password);
    if (checkPassword === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "james_key");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  } else {
    response.status(400);
    response.send("Invalid user");
  }
});

// Authentication with JWT Token
const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "james_key", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//API 3 /user/tweets/feed/
app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  let { username } = request;
  const getUserIdQuery = `
            SELECT 
                user_id 
            FROM 
                user
            WHERE 
                username = "${username}";`;
  const getUserId = await db.get(getUserIdQuery);
  const getFollowerIdsQuery = `
            SELECT 
                following_user_id
            FROM 
                follower
            WHERE 
                follower_user_id = "${getUserId.user_id}";`;
  const getFollowerIdsArray = await db.all(getFollowerIdsQuery);
  const getFollowerIdsSimple = getFollowerIdsArray.map((eachUser) => {
    return eachUser.following_user_id;
  });
  const getTweetQuery = `
            SELECT
                user.username, tweet.tweet, tweet.date_time AS dateTime
            FROM 
                user INNER JOIN
                tweet ON user.user_id = tweet.user_id
            WHERE 
                user.user_id IN (${getFollowerIdsSimple})
            ORDER BY
                tweet.date_time DESC
            LIMIT 
                4;`;
  const responseResult = await db.all(getTweetQuery);
  response.send(responseResult);
});

//API 4 /user/following/
app.get("/user/following/", authenticateToken, async (request, response) => {
  let { username } = request;
  const getUserIdQuery = `
            SELECT 
                user_id 
            FROM 
                user
            WHERE 
                username = "${username}";`;
  const getUserId = await db.get(getUserIdQuery);
  const getFollowingIdsQuery = `
            SELECT 
                following_user_id
            FROM 
                follower
            WHERE 
                follower_user_id = "${getUserId.user_id}";`;
  const getFollowingIdsArray = await db.all(getFollowingIdsQuery);
  const getFollowingIds = getFollowingIdsArray.map((eachUser) => {
    return eachUser.following_user_id;
  });
  const getFollowingNameQuery = `
            SELECT 
                name
            FROM 
                user
            WHERE
                user_id IN (${getFollowingIds});`;
  const responseResult = await db.all(getFollowingNameQuery);
  response.send(responseResult);
});

//API 5 /user/followers/
app.get("/user/followers/", authenticateToken, async (request, response) => {
  let { username } = request;
  const getUserIdQuery = `
            SELECT 
                user_id 
            FROM 
                user
            WHERE 
                username = "${username}";`;
  const getUserId = await db.get(getUserIdQuery);
  const getFollowerIdsQuery = `
            SELECT 
                follower_user_id
            FROM 
                follower
            WHERE 
                following_user_id = "${getUserId.user_id}";`;
  const getFollowerIdsArray = await db.all(getFollowerIdsQuery);
  const getFollowerIds = getFollowerIdsArray.map((eachUser) => {
    return eachUser.follower_user_id;
  });
  const getFollowersNameQuery = `
            SELECT 
                name
            FROM 
                user
            WHERE
                user_id IN (${getFollowerIds});`;
  const getFollowersName = await db.all(getFollowersNameQuery);
  response.send(getFollowersName);
});

//API 6 /tweets/:tweetId/

const api6Output = (tweetData, likesCount, replyCount) => {
  return {
    tweet: tweetData.tweet,
    likes: likesCount.likes,
    replies: replyCount.replies,
    dateTime: tweetData.date_time,
  };
};

app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
  const { tweetId } = request.params;
  console.log(tweetId);
  let { username } = request;
  const getUserIdQuery = `
            SELECT 
                user_id 
            FROM 
                user
            WHERE 
                username = "${username}";`;
  const getUserId = await db.get(getUserIdQuery);
  //console.log(getUserId);
  const getFollowingIdsQuery = `
            SELECT 
                following_user_id
            FROM 
                follower
            WHERE 
                follower_user_id = "${getUserId.user_id}";`;
  const getFollowingIdsArray = await db.all(getFollowingIdsQuery);
  //console.log(getFollowingIdsArray);
  const getFollowingIds = getFollowingIdsArray.map((eachFollower) => {
    return eachFollower.following_user_id;
  });
  const getTweetIdsQuery = `
            SELECT
                tweet_id
            FROM 
                tweet
            WHERE 
                user_id IN (${getFollowingIds});`;
  const getTweetIdsArray = await db.all(getTweetIdsQuery);
  //console.log(getTweetIdsArray);
  const followingTweetIds = getTweetIdsArray.map((eachId) => {
    return eachId.tweet_id;
  });
  //console.log(followingTweetIds);
  const getResponseResult = followingTweetIds.includes(parseInt(tweetId));
  if (getResponseResult) {
    //console.log(tweetId);
    const likes_count_query = `
            SELECT 
                count(user_id) as likes
            FROM 
                like
            WHERE 
                tweet_id = ${tweetId};`;
    const likes_count = await db.get(likes_count_query);
    //console.log(likes_count);
    const reply_count_query = `
            SELECT 
                count(user_id) as replies
            FROM 
                reply
            WHERE 
                tweet_id = ${tweetId};`;
    const reply_count = await db.get(reply_count_query);
    //console.log(reply_count);
    const tweet_tweetDateQuery = `
            SELECT 
                tweet,
                date_time
            FROM 
                tweet
            WHERE
                tweet_id = ${tweetId};`;
    //console.log(tweet_tweetDateQuery);
    const tweet_tweetDate = await db.get(tweet_tweetDateQuery);
    //console.log(tweet_tweetDate);
    response.send(api6Output(tweet_tweetDate, likes_count, reply_count));
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});

//API 7 /tweets/:tweetId/likes/
const convertLikesUserNameDbObjectToResponseObject = (dbObject) => {
  return {
    likes: dbObject,
  };
};

app.get(
  "/tweets/:tweetId/likes/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    let { username } = request;
    const getUserIdQuery = `
            SELECT 
                user_id 
            FROM 
                user
            WHERE 
                username = "${username}";`;
    const getUserId = await db.get(getUserIdQuery);

    const getFollowingIdsQuery = `
            SELECT 
                following_user_id
            FROM 
                follower
            WHERE 
                follower_user_id = "${getUserId.user_id}";`;
    const getFollowingIdsArray = await db.all(getFollowingIdsQuery);
    const getFollowingIds = getFollowingIdsArray.map((eachFollower) => {
      return eachFollower.following_user_id;
    });

    const getTweetIdsQuery = `
            SELECT
                tweet_id
            FROM 
                tweet
            WHERE 
                user_id IN (${getFollowingIds});`;
    const getTweetIdsArray = await db.all(getTweetIdsQuery);
    const getTweetIds = getTweetIdsArray.map((eachTweet) => {
      return eachTweet.tweet_id;
    });

    if (getTweetIds.includes(parseInt(tweetId))) {
      const getLikedUsersNameQuery = `
            SELECT
                user.username as likes
            FROM
                user INNER JOIN
                like ON user.user_id = like.user_id
            WHERE 
                like.tweet_id = ${tweetId};`;
      const getLikedUsersNamesArray = await db.all(getLikedUsersNameQuery);
      const getLikedUserNames = getLikedUsersNamesArray.map((eachUser) => {
        return eachUser.likes;
      });
      response.send(
        convertLikesUserNameDbObjectToResponseObject(getLikedUserNames)
      );
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

//API 8 /tweets/:tweetId/replies/
const convertUserNameRepliesDbObjectToResponseObject = (dbObject) => {
  return {
    replies: dbObject,
  };
};

app.get(
  "/tweets/:tweetId/replies/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    let { username } = request;
    const getUserIdQuery = `
            SELECT 
                user_id 
            FROM 
                user
            WHERE 
                username = "${username}";`;
    const getUserId = await db.get(getUserIdQuery);

    const getFollowingIdsQuery = `
            SELECT 
                following_user_id
            FROM 
                follower
            WHERE 
                follower_user_id = "${getUserId.user_id}";`;
    const getFollowingIdsArray = await db.all(getFollowingIdsQuery);
    const getFollowingIds = getFollowingIdsArray.map((eachFollower) => {
      return eachFollower.following_user_id;
    });

    const getTweetIdsQuery = `
            SELECT
                tweet_id
            FROM 
                tweet
            WHERE 
                user_id IN (${getFollowingIds});`;
    const getTweetIdsArray = await db.all(getTweetIdsQuery);
    const getTweetIds = getTweetIdsArray.map((eachTweet) => {
      return eachTweet.tweet_id;
    });

    if (getTweetIds.includes(parseInt(tweetId))) {
      const getUsersNameReplyTweetsQuery = `
            SELECT
                user.name,
                reply.reply
            FROM
                user INNER JOIN
                reply ON user.user_id = reply.user_id
            WHERE 
                reply.tweet_id = ${tweetId};`;
      const getUsersNameReplyTweetsArray = await db.all(
        getUsersNameReplyTweetsQuery
      );
      response.send(
        convertUserNameRepliesDbObjectToResponseObject(
          getUsersNameReplyTweetsArray
        )
      );
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

//API 9 /user/tweets/
app.get("/user/tweets/", authenticateToken, async (request, response) => {
  let { username } = request;
  const getUserIdQuery = `SELECT user_id FROM user WHERE username = "${username}";`;
  const getUserId = await db.get(getUserIdQuery);

  const getTweetsDetailsQuery = `
        SELECT 
            tweet,
            COUNT(DISTINCT like_id) AS likes,
            COUNT(DISTINCT reply_id) AS replies,
            date_time AS dateTime
        FROM 
            tweet LEFT JOIN 
            reply ON tweet.tweet_id = reply.tweet_id
            LEFT JOIN like
            ON tweet.tweet_id = like.tweet_id
        WHERE
            tweet.user_id = ${getUserId.user_id}
        GROUP BY
            tweet.tweet_id;`;
  const getTweetsDetails = await db.all(getTweetsDetailsQuery);
  response.send(getTweetsDetails);
});

//API 10 /user/tweets/
app.post("/user/tweets/", authenticateToken, async (request, response) => {
  let { username } = request;
  const getUserIdQuery = `SELECT user_id FROM user WHERE username = "${username}";`;
  const getUserId = await db.get(getUserIdQuery);

  const { tweet } = request.body;

  const currentDate = new Date();

  const postRequestQuery = `
        INSERT INTO
            tweet(tweet, user_id, date_time)
        VALUES
            ("${tweet}", ${getUserId.user_id}, "${currentDate}");`;
  const responseResult = await db.run(postRequestQuery);
  const tweet_id = responseResult.lastID;
  console.log(tweet_id);
  response.send("Created a Tweet");
});

//API 11 /tweets/:tweetId/
app.delete(
  "/tweets/:tweetId/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    let { username } = request;
    const getUserIdQuery = `
            SELECT 
                user_id 
            FROM 
                user 
            WHERE 
                username = "${username}";`;
    const getUserId = await db.get(getUserIdQuery);

    const getUserTweetsListQuery = `
            SELECT 
                tweet_id
            FROM 
                tweet
            WHERE
                user_id = ${getUserId.user_id};`;
    const getUserTweetsListArray = await db.all(getUserTweetsListQuery);
    const getUserTweetsList = getUserTweetsListArray.map((eachTweetId) => {
      return eachTweetId.tweet_id;
    });

    if (getUserTweetsList.includes(parseInt(tweetId))) {
      const deleteTweetQuery = `
                DELETE FROM
                    tweet
                WHERE
                    tweet_id = ${tweetId};`;
      await db.run(deleteTweetQuery);
      response.send("Tweet Removed");
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

module.exports = app;
