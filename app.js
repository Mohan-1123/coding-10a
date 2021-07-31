const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;

const intiDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("server is starting at http://localhost:3000");
    });
  } catch (error) {
    console.log(`DB error:${error.message}`);
    process.exit(1);
  }
};

intiDbAndServer();

// app.post("/login/", async (request, response) => {
//   const { username, password } = request.body;
//   const userQuery = `
//     SELECT
//      *
//     FROM
//      user
//     WHERE
//      username='${username}';`;

//   const dbUser = await db.get(userQuery);
//   if (dbUser === undefined) {
//     response.status(400);
//     response.send("Invalid user");
//   } else {
//     const cmPassword = await bcrypt.compare(password, dbUser.password);
//     if (cmPassword === true) {
//       const payload = { username: username };
//       const jwtToken = jwt.sign(payload, "MY_PASSWORD");
//       response.send(jwtToken);
//     } else {
//       response.status(400);
//       response.send("Invalid Password");
//     }
//   }
// });

const authentication = (request, response, next) => {
  let jwToken;
  const header = request.headers["authorization"];

  if (header !== undefined) {
    jwToken = header.split(" ")[1];
    console.log(jwToken);
  }
  if (jwToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwToken, "MY_PASSWORD", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const databaseUser = await db.get(selectUserQuery);
  if (databaseUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(
      password,
      databaseUser.password
    );
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

convertStateToResponseObj = (dbObj) => {
  return {
    stateId: dbObj.state_id,
    stateName: dbObj.state_name,
    population: dbObj.population,
  };
};

app.get("/states/", authentication, async (request, response) => {
  const stateQuery = `
      SELECT 
        * 
      FROM 
       state;`;
  const dbData = await db.all(stateQuery);
  const result = dbData.map((eachElement) =>
    convertStateToResponseObj(eachElement)
  );
  response.send(result);
});

app.get("/states/:stateId/", authentication, async (request, response) => {
  const { stateId } = request.params;
  const queryId = `
   SELECT 
    * 
   FROM 
    state 
   WHERE 
    state_id=${stateId};`;

  const result = await db.get(queryId);
  response.send(convertStateToResponseObj(result));
});

app.post("/districts/", authentication, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;

  const query = `
    INSERT INTO
    district (state_id, district_name, cases, cured, active, deaths)
  VALUES
    (${stateId}, '${districtName}', ${cases}, ${cured}, ${active}, ${deaths});`;
  await db.run(query);
  response.send("District Successfully Added");
});

const districtObjToResponseObj = (dbObj) => {
  return {
    districtId: dbObj.district_id,
    districtName: dbObj.district_name,
    stateId: dbObj.state_id,
    cases: dbObj.cases,
    cured: dbObj.cured,
    active: dbObj.active,
    deaths: dbObj.deaths,
  };
};

app.get(
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    const { districtId } = request.params;

    const query = `
     SELECT 
      * 
     FROM 
      district
     WHERE 
      district_id=${districtId};`;

    const result = await db.get(query);
    response.send(districtObjToResponseObj(result));
  }
);

app.delete(
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    const { districtId } = request.params;

    const query = `
     DELETE FROM district
     WHERE 
      district_id=${districtId};`;

    await db.run(query);
    response.send("District Removed");
  }
);

app.put(
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    const { districtId } = request.params;

    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;

    const query = `
     UPDATE district
     SET
       district_name='${districtName}',
       state_id=${stateId},
       cases=${cases},
       cured=${cured},
       active=${active},
       deaths=${deaths}
    WHERE
      district_id=${districtId};`;

    await db.run(query);
    response.send("District Details Updated");
  }
);

app.get(
  "/states/:stateId/stats/",
  authentication,
  async (request, response) => {
    const { stateId } = request.params;

    const query = `
    SELECT 
      SUM(cases) AS totalCases,
      SUM(cured) AS totalCured,
      SUM(active) AS totalActive,
      SUM(deaths) AS totalDeaths
    FROM 
      district 
    WHERE 
     state_id=${stateId};`;

    const result = await db.get(query);
    response.send(result);
  }
);

module.exports = app;
