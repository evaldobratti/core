const async = require('async');
const utility = require('../util/utility');
const generateJob = utility.generateJob;
const getData = utility.getData;
const redis = require('../store/redis');
const db = require('../store/db');
const cassandra = require('../store/cassandra');
const queries = require('../store/queries');
const insertMatch = queries.insertMatch;
const delay = 1000;
start();

function start()
{
  redis.zrange('tracked', 0, -1, function (err, account_ids)
  {
    console.log(account_ids.length);
    async.eachLimit(account_ids, 10, function (account_id, cb)
    {
      var ajob = generateJob('api_history',
      {
        account_id: account_id
      });
      getData(
      {
        url: ajob.url,
        delay: delay
      }, function (err, body)
      {
        if (err)
        {
          console.error(err);
        }
        // Get matches with recent seqnums
        var matches = body.result.matches.filter(function (m)
        {
          return m.match_seq_num > 2219009634;
        }).map(function (m)
        {
          return m.match_id;
        });
        async.each(matches, function (match_id, cb)
        {
          var job = generateJob("api_details",
          {
            match_id: match_id
          });
          var url = job.url;
          getData(
          {
            url: url,
            delay: delay
          }, function (err, body)
          {
            if (err)
            {
              throw err;
            }
            if (body.result)
            {
              var match = body.result;
              insertMatch(db, redis, match,
              {
                skipCounts: true,
                skipAbilityUpgrades: true,
                skipParse: true,
                cassandra: cassandra,
                attempts: 1,
              }, cb);
            }
            else
            {
              throw body;
            }
          });
        }, cb);
      });
    }, function (err)
    {
      if (err)
      {
        console.error(err);
      }
      start();
    });
  });
}
