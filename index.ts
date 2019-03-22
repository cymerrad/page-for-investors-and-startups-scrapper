import asynch from "async";
import fs from "fs";
import puppeteer from "puppeteer";

const modeDebug = true;

const debug = (...args: any[]) => {
  if (modeDebug) {
    console.log(...args);
  }
};

const dimensions = {
  width: 1920,
  height: 1080
};

async function scrollDown(
  page: puppeteer.Page,
  curHeight: number,
  downBy: number
) {
  // add
  let height = curHeight + downBy;

  // 'instant' in opposition to 'smooth'
  await page.evaluate(`window.scrollTo({top: ${height}, behavior: 'instant'})`);

  // wait for site's potential javascript to notice the change and do it's thing with css
  await (async () => new Promise(resolve => setTimeout(resolve, 200)))();

  // site's height might have changed
  let pageHeight = await page.evaluate("document.body.scrollHeight");

  return [height, pageHeight];
}

const hashCode = function(string: String) {
  var hash = 0,
    i,
    chr;
  if (string.length === 0) return hash;
  for (i = 0; i < string.length; i++) {
    chr = string.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
};

interface CompanyRow {
  Company: string;
  Link: string;
  Description: string;
  Joined: string;
  Followers: string;
}

const rowItemClass = "item column"; // this contains Company and Link
const rowItemLinkClass = "startup-link"; // [0] -> .href, [0] -> .title
const rowItemDescriptionClass = "blurb"; // [0] -> .innerText

const rowJoinedClass = "column joined"; // -> '.value' -> .innerText
const rowFollowersClass = "column followers"; // -> '.value' -> .innerText

function scrapeDataFromBatch(batch: Element): CompanyRow[] {
  try {
    let rawData = Array.from(batch.children).map(row => {
      const itemCollection = row.getElementsByClassName(rowItemClass);
      const [item] = Array.from(itemCollection);
      const linkName: any = item.getElementsByClassName(rowItemLinkClass)[0];
      const link = linkName.href;
      const name = linkName.title;

      const descriptionElem: any = item.getElementsByClassName(
        rowItemDescriptionClass
      )[0];
      const description = descriptionElem.innerText;

      const joinedElem = row.getElementsByClassName(rowJoinedClass)[0];
      const joinedElem2: any = joinedElem.getElementsByClassName("value")[0];
      const joined = joinedElem2.innerText;

      const followersElem = row.getElementsByClassName(rowFollowersClass)[0];
      const followersElem2: any = followersElem.getElementsByClassName(
        "value"
      )[0];
      const followers = followersElem2.innerText;

      return {
        Company: name,
        Link: link,
        Description: description,
        Followers: followers,
        Joined: joined
      } as CompanyRow;
    });

    return rawData;
  } catch {
    return [];
  }
}

async function scrapeAllPossibleData(
  page: puppeteer.Page
): Promise<CompanyRow[]> {
  // So angel.co works like this:
  // Every time you click button "More", another div is added to '.results_holder' element.
  // There is a limit on how many listings you can see, however.
  // When that is reached, every next batch of results added to '.results_holder' will contain no children.
  // So length of the last child of '.results_holder' will be our invariant.
  // We could also use the page height.
  const resultsHolderSelector = ".results_holder";
  const moreButtonSelector = ".more hidden";
  const loadingButtonSelector = ".loading_image";

  debug("Waiting for results_holder");
  await page.waitForSelector(resultsHolderSelector);

  const getLastChildData = (resultsSelector: string) => {
    const rowItemClass = "item column"; // this contains Company and Link
    const rowItemLinkClass = "startup-link"; // [0] -> .href, [0] -> .title
    const rowItemDescriptionClass = "blurb"; // [0] -> .innerText

    const rowJoinedClass = "column joined"; // -> '.value' -> .innerText
    const rowFollowersClass = "column followers"; // -> '.value' -> .innerText

    try {
      const [results] = document.querySelectorAll(resultsSelector);
      const last = Array.from(results.children).pop();

      if (last === undefined || last.children.length === 0) {
        console.log("Nothing found");
        return [];
      }

      let rawData = Array.from(last.children).map(row => {
        const itemCollection = row.getElementsByClassName(rowItemClass);
        const [item] = Array.from(itemCollection);
        const linkName: any = item.getElementsByClassName(rowItemLinkClass)[0];
        const link = linkName.href;
        const name = linkName.title;

        const descriptionElem: any = item.getElementsByClassName(
          rowItemDescriptionClass
        )[0];
        const description = descriptionElem.innerText;

        const joinedElem = row.getElementsByClassName(rowJoinedClass)[0];
        const joinedElem2: any = joinedElem.getElementsByClassName("value")[0];
        const joined = joinedElem2.innerText;

        const followersElem = row.getElementsByClassName(rowFollowersClass)[0];
        const followersElem2: any = followersElem.getElementsByClassName(
          "value"
        )[0];
        const followers = followersElem2.innerText;

        return {
          Company: name,
          Link: link,
          Description: description,
          Followers: followers,
          Joined: joined
        } as CompanyRow;
      });

      return rawData;
    } catch (err) {
      console.log("Caught on fire", err);
      return [];
    }
  };

  let data = [];
  let height = 0;

  let lastBatch = await page.evaluate(getLastChildData, resultsHolderSelector);
  let lastBatchHash = hashCode(JSON.stringify(lastBatch));
  // debug("Last batch", lastBatch);
  while (lastBatch && lastBatch.length > 0) {
    data.push(...lastBatch);

    // scroll to the bottom of the page first - in case of dynamic, 'infinite' loading
    // let pageHeight = await page.evaluate("document.body.scrollHeight");
    // while (height < pageHeight) {
    //   debug("Scrolling...");
    //   [height, pageHeight] = await scrollDown(page, height, dimensions.height);
    // }

    // click 'More'
    // await page.waitForSelector(moreButtonSelector);
    debug("Clicking 'More'");
    // await page.click(moreButtonSelector);
    // alternative to above
    await page.evaluate(buttonClassName => {
      let but: any = document.getElementsByClassName(buttonClassName)[0];
      but.click();
    }, "more hidden");

    debug("Waiting for loading to start");
    await page.waitForSelector(loadingButtonSelector);
    debug("Waiting for loading to end");
    await page.waitForSelector(loadingButtonSelector, { hidden: true });
    debug("Loaded more content");

    lastBatch = await page.evaluate(getLastChildData, resultsHolderSelector);
    // debug("Last batch", lastBatch);
  }

  debug("Exiting the loop");
  // let pageHeight = await page.evaluate("document.body.scrollHeight");
  // let height = 0;
  // while (height < pageHeight) {
  //   [height, pageHeight] = await scrollDown(page, height, dimensions.height);
  // }

  return data;
}

const angelList = "bitcoin-exchange";
const address = "https://angel.co/" + angelList;

(async () => {
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    userDataDir: "./user_data",
    headless: false
  });
  const page = await browser.newPage();
  await page.setViewport(dimensions);

  await page.goto(address, {
    waitUntil: "networkidle0"
  });

  var data: any[] = [];
  var pairs: ({} | undefined)[] = []; // compatibility hack

  try {
    data = await scrapeAllPossibleData(page);
    const fileName = angelList + ".json";
    fs.writeFileSync(fileName, JSON.stringify(data));
    console.log(`Wrote to ${fileName}`);

    let count = data.length;
    let counter = 1;

    await asynch.mapSeries(
      data,
      async company => {
        debug("Fixing URL of", company.Company, `${counter}/${count}`);
        let companyPage = await browser.newPage();
        await companyPage.goto(company.Link, { waitUntil: "networkidle0" });

        debug("Waiting for url to appear");
        await companyPage.waitForFunction(
          "document.getElementsByClassName('company_url')[0]",
          { polling: 1000, timeout: 0 }
        );

        let trueCompanyUrl = await companyPage.evaluate(trueLinkClassName => {
          var potentialUrls = document.getElementsByClassName(
            trueLinkClassName
          );
          if (potentialUrls.length === 0) {
            return undefined;
          } else {
            return (potentialUrls[0] as any).href;
          }
        }, "company_url");

        if (trueCompanyUrl === undefined) {
          // one more try
          trueCompanyUrl = await companyPage.evaluate(trueLinkClassName => {
            var potentialUrls = document.getElementsByClassName(
              trueLinkClassName
            );
            if (potentialUrls.length === 0) {
              return undefined;
            } else {
              return (potentialUrls[0] as any).href;
            }
          }, "company_url");
          if (trueCompanyUrl === undefined) {
            debug("We failed on", company.Company);
          }
        }

        const pair = [company.Link, trueCompanyUrl];
        company.Link = trueCompanyUrl; // attempt at overwriting?

        companyPage.close();

        debug(`${pair[0]} -> ${pair[1]}`);
        counter++;
        return pair;
      },
      (err, pairz) => {
        let suffix = "";
        if (err) {
          console.log("Error in mapSeries", err);
          suffix = "_errored_out";
        }

        fs.writeFileSync(`pairs${suffix}.json`, JSON.stringify(pairz));
        if (pairz !== undefined) pairs = pairz;
      }
    );

    let pairsFileName = angelList + `_pairs.json`;
    fs.writeFileSync(pairsFileName, JSON.stringify(pairs));
    console.log("Wrote even more to", pairsFileName);
  } catch (err) {
    console.log("Error, screenshoting the page");

    await page.screenshot({
      path: `error_${new Date().getTime()}.png`,
      fullPage: true
    });

    console.log(err);

    fs.writeFileSync("ERROR_pairs.json", JSON.stringify(pairs));
    fs.writeFileSync("ERROR_data", JSON.stringify(data));
  }
})();
