const db = require("./database");
const dotenv = require('dotenv');
dotenv.config();

const init = async () => {
  await db.run('CREATE TABLE Users (id INTEGER PRIMARY KEY AUTOINCREMENT, name varchar(32));');
  await db.run('CREATE TABLE Friends (id INTEGER PRIMARY KEY AUTOINCREMENT, userId int, friendId int);');
  const users = [];
  const names = ['foo', 'bar', 'baz'];
  for (i = 0; i < 27000; ++i) {
    let n = i;
    let name = '';
    for (j = 0; j < 3; ++j) {
      name += names[n % 3];
      n = Math.floor(n / 3);
      name += n % 10;
      n = Math.floor(n / 10);
    }
    users.push(name);
  }
  const friends = users.map(() => []);
  for (i = 0; i < friends.length; ++i) {
    const n = 10 + Math.floor(90 * Math.random());
    const list = [...Array(n)].map(() => Math.floor(friends.length * Math.random()));
    list.forEach((j) => {
      if (i === j) {
        return;
      }
      if (friends[i].indexOf(j) >= 0 || friends[j].indexOf(i) >= 0) {
        return;
      }
      friends[i].push(j);
      friends[j].push(i);
    });
  }

  console.log("Init Users Table...");
  await Promise.all(users.map((un) => db.run(`INSERT INTO Users (name) VALUES ('${un}');`)));
  console.log("Init Friends Table...");
  await Promise.all(friends.map((list, i) => {
    return Promise.all(list.map((j) => db.run(`INSERT INTO Friends (userId, friendId) VALUES (${i + 1}, ${j + 1});`)));
  }));
  // Creating Indexes Of Friends Table
  await db.run('CREATE INDEX index_friendId ON Friends (friendId);');
  await db.run('CREATE INDEX index_userId ON Friends (userId);');
  console.log("Ready.");
};

const search = async (req, res) => {
  const query = req.params.query;
  const userId = parseInt(req.params.userId);
  db.all(`${generateDbSearchQuery({userId, search: query})}`)
    .then((results) => {
      res.statusCode = 200;

      res.json({
        success: true,
        users: results.filter((x) => x.connection > 0),
      });
    })
    .catch((err) => {
      console.log("Search Err:", err);
      res.statusCode = 500;
      res.json({ success: false, error: err });
    });
};

const unfriend = async (req, res) => {
  const userId = parseInt(req.params.userId);
  const friendId = parseInt(req.params.friendId);
  db.all(
    `Delete from Friends where friendId = ${friendId} AND userId = ${userId};`
  )
    .then((results) => {
      res.statusCode = 200;
      res.json({
        success: true,
        users: results,
      });
    })
    .catch((err) => {
      console.log("Unfriend Err:", err);
      res.statusCode = 500;
      res.json({ success: false, error: err });
    });
};

const friend = async (req, res) => {
  const userId = parseInt(req.params.userId);
  const friendId = parseInt(req.params.friendId);
  db.all(
    `INSERT INTO Friends (userId, friendId) VALUES (${userId}, ${friendId});`
  )
    .then((results) => {
      res.statusCode = 200;
      res.json({
        success: true,
        users: results,
      });
    })
    .catch((err) => {
      console.log("friend Err:", err);
      res.statusCode = 500;
      res.json({ success: false, error: err });
    });
};

const generateDbSearchQuery = (dto) => {
  let search = dto.search || '';
  let userId = dto.userId;
  const connectionLevel = process.env.CONNECTION_LEVEL || 1;
  let query = `SELECT u.id, u.name, 
  CASE
  `;
  for (let i = 1; i <= connectionLevel; i++) {
    let tmp = `  WHEN EXISTS (
      SELECT 1
      FROM Friends f1`
    query += tmp
    if(i==1){
      tmp = `
      WHERE f1.userId = ${userId} AND f1.friendId = u.id`
      query += tmp
    } else if (i==2){
      tmp = ''
      for(let j=1; j < i; j++){
        tmp += `
        INNER JOIN Friends f${j+1} ON f${j+1}.userId = f1.friendId`
      }
      tmp += `
      WHERE f1.userId = ${userId} AND f${i}.friendId = u.id`
      query += tmp
    } else {
      tmp = ''
      for(let j=1; j < i; j++){
        tmp += `
        INNER JOIN Friends f${j+1} ON f${j+1}.userId = f${j}.friendId `
      }
      tmp += `
      WHERE f1.userId = ${userId} AND (f${i}.friendId = u.id OR f1.friendId = u.id)`
      query += tmp
    }
    tmp = `
    ) THEN ${i}
    `
    query += tmp
  }
  query += `ELSE 0 
  END AS connection
  FROM Users u
  WHERE name LIKE '%${search}%'
  LIMIT 20;`;
  // console.log(query)
  return query
}

module.exports = {
  init,
  search,
  unfriend,
  friend,
};
