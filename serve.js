const axios = require('axios');
const cheerio = require('cheerio');
const mongoose = require('mongoose');
const fs = require('fs');
const readline = require('readline');
const path = require('path');

// 连接到 MongoDB
mongoose.connect('mongodb://127.0.0.1:27017/scraping', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000, // 连接超时时间设置为5秒
  socketTimeoutMS: 45000 // 传输超时时间设置为45秒
 });
mongoose.connection.on('connected',function(){
  console.log('Mongoose connection open to ');
})

mongoose.connection.on('error',function(err){
  console.log('Mongoose connection error:' + err);
})

mongoose.connection.on('disconnected',function(){
  console.log('Mongoose connection disconnected');
})
// 定义列表模型
const RegionSchema = new mongoose.Schema({
  standardName: String,
  city: String,
  county: String,
  shortName: String,
  aliasName: String,
  usedName: String,
  id: { type: String, unique: true } // id 作为唯一键
});
const Region = mongoose.model('Region', RegionSchema);

// 定义详情模型
const regionDetailSchema = new mongoose.Schema({
  id: String,
  rome: String,
  useTime: String,
  fullName: String,
  origin: String,
  describe: String,
  remark: String
});

const RegionDetail = mongoose.model('RegionDetail', regionDetailSchema);

/**
 * 获取ID的函数，从URL中提取ID
 * @param {*} url
 * @returns id
 */
function getIDFromURL(url) {
    // 创建一个URL对象
    const u = new URL(url, 'http://example.com'); // 注意：需要提供一个基础URL来解析相对URL

    // 使用URLSearchParams获取查询参数
    const params = new URLSearchParams(u.search);

    // 尝试获取ID参数的值
    const id = params.get('ID');

    // 如果没有找到ID参数，则返回null或其他默认值
    return id || null; // 或者你可以返回undefined, ''等
}

// 要爬取的URL模板
// 列表url todo
const BASE_URL = '';
// 详情url todo
const DETAIL_URL = '';

/**
 * 爬取指定列表页面的函数
 * @param {*} pageId 分页ID
 */
async function scrapePage(pageId) {
    try {
        const { data } = await axios.get(`${BASE_URL}${pageId}.html`);
        const $ = cheerio.load(data);

        // 解析标准名称等信息
        const table = $('table').eq(21); // 根据具体的HTML结构选择元素
        const rows = $(table).find("tr"); // 根据具体的HTML结构选择元素

        rows.each(async (index, element) => {
            const columns = $(element).find('td');
            if (columns.length > 0) {
                let url = $(columns[6]).find('a').attr('href');
                let id = getIDFromURL(url);
                if (!id) {
                    return; // 如果没有找到ID，则跳过该行
                }
                const entry = {
                    standardName: $(columns[0]).text().trim(),  // 标准名称
                    city: $(columns[1]).text().trim(),          // 所属市
                    county: $(columns[2]).text().trim(),        // 所属县区
                    shortName: $(columns[3]).text().trim(),     // 简称
                    aliasName: $(columns[4]).text().trim(),     // 别名
                    usedName: $(columns[5]).text().trim(),      // 曾用名
                    id: id,                                     // 从URL中获取的id
                };

                // console.log('entry ==', entry);

                // 检查数据库中是否存在该 ID
                const existingRegion = await Region.findOne({ id: id });
                if (!existingRegion) {
                    // 如果不存在则插入
                    const newRegion = new Region(entry);
                    await newRegion.save();
                    // console.log(`Inserted entry with id ${id}`);
                } else {
                    console.log(`Entry with id ${id} already exists, skipping.`);
                }
            }
        });

    } catch (error) {
        console.error(`Error scraping page ${pageId}:`, error);
        logFailedScrape('failed_scrapes.txt',pageId, error);
    }
}


/**
 * 获取列表上所有的ids
 * @returns 返回需要爬取的 ID 列表
 */
async function getRegionIds() {
  try {
    // 从 RegionDetail 表中获取已经存在的 id
    const existingDetails = await RegionDetail.find({}, { id: 1 });
    const existingIds = existingDetails.map(detail => detail.id);
    // 查询 regions 表中那些不在 RegionDetail 表中的 id
    const regionsToScrape = await Region.find({
      id: { $nin: existingIds }
    }, { id: 1 });

    const idsToScrape = regionsToScrape.map(region => region.id);

    return idsToScrape;
  } catch (err) {
    console.error('Error fetching region IDs:', err);
  }
}

/***
 * 写入日志文件
 * @param {*} fileName 日志文件名
 * @param {*} id       id
 * @param {*} error    内容
 */
function logFailedScrape(fileName,id, error) {
  const errorMessage = `ID: ${id}, Error: ${error.message}\n`;
  fs.appendFileSync(fileName, errorMessage, (err) => {
    if (err) console.error('Error writing to log file:', err);
  });
}

/**
 * 爬取详情页
 * @param {*} id
 * @returns
 */
async function scrapeDetailsById(id) {
  try {
    // 先检查该 id 是否已存在于第二张表中
    const existingDetail = await RegionDetail.findOne({ id });
    if (existingDetail) {
      console.log(`Details for ID ${id} already exist, skipping.`);
      return;  // 如果已经存在，跳过该 id
    }

    // 如果不存在则继续爬取
    const url = `${DETAIL_URL}${id}`;  // 假设详情页的 URL 格式
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    let tr = $('tbody').eq(21).find('tr')
    // 提取详情页中的数据
    const details = {
      id: id,  // 存储当前的id
      rome: tr.eq(1).find('td').eq(1).text().trim(),        // 罗马字母拼写
      useTime: tr.eq(2).find('td').eq(1).text().trim(),     // 使用时间
      fullName: tr.eq(4).find('td').eq(1).text().trim(),    // 所在（跨）行政区
      origin: tr.eq(5).find('td').eq(1).text().trim(),      // 来历、含义及历史沿革
      describe: tr.eq(6).find('td').eq(1).text().trim(),    // 地理实体概况
      remark: tr.eq(7).find('td').eq(1).text().trim()       // 备注
    };

    console.log('Scraped details for ID:', id, details);

    // 存储到第二张表中
    const regionDetail = new RegionDetail(details);
    await regionDetail.save();

  } catch (err) {
    console.error(`Error scraping details for ID ${id}:`, err);
    logFailedScrape('failed_scrape_details.txt',id, err);  // 记录错误到本地文件
  }
}

/**
* 1.启动爬虫，爬取列表。从指定页开始爬取[爬取列表]**************************************************************************
 */
//从1开始，20992结束
// (async function startScraping() {
//     const startPage = 1;
//     const endPage = 20992; // 设置爬取的页数范围，根据实际需要调整

//     for (let i = startPage; i <= endPage; i++) {
//         await scrapePage(i);
//     }

//     console.log('Scraping finished.');
// })();

/**
 * 2.爬取详情***************************************************************************
 */
// async function getDetail() {
//   const ids = await getRegionIds();  // 获取所有id
//   for (const id of ids) {
//     await scrapeDetailsById(id);  // 爬取每个详情页
//   }
//   mongoose.connection.close();  // 完成后关闭数据库连接
// }

// getDetail()


/**
 * 3.读取日志文件并重新爬取失败的ID**************************************************************************
 * @param {*} filePath 日志路径
 * @param {*} callback 查询方法
 */
async function retryFailedScrapes(filePath,callback) {
  const failedIds = [];

  // 读取 failed_scrapes.txt 文件
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  // 逐行读取文件并解析出 ID
  for await (const line of rl) {
    const match = line.match(/ID: (\d+), Error:/);
    if (match) {
      failedIds.push(match[1]);
    }
  }

  console.log(`Retrying ${failedIds.length} failed scrapes...`);

  // 逐个 ID 重试爬取
  for (const id of failedIds) {
    try {
      await callback(id);
      console.log(`Successfully retried ID: ${id}`);
    } catch (err) {
      console.error(`Failed to retry ID: ${id}, Error: ${err.message}`);
      // 失败后仍然可以记录日志或采取其他措施
    }
  }
}

/**
 * 对于详情爬取失败的进行调用重试方法
 * @param {string} filePath 文件路径
 * @param {function} callback 回调函数
 */
// retryFailedScrapes('./failed_scrape_details.txt',scrapeDetailsById);


/***
 * 下载指定页面上的图片******************************
 */

// 下载图片并保存到本地
async function downloadImage(imageUrl, folderPath, filename) {
    const filePath = path.resolve(folderPath, filename);
    const writer = fs.createWriteStream(filePath);

    const response = await axios({
        url: imageUrl,
        method: 'GET',
        responseType: 'stream'
    });

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
}

// 主函数：获取页面上的所有图片并保存
async function scrapeImages(url) {
    try {
        // 从 URL 中提取路径部分用于创建文件夹（如 h-col-115）
        const folderName = url.match(/\/([^\/]+)\.html/)[1];
        const imagesDir = path.resolve(__dirname, folderName);

        // 如果文件夹不存在则创建
        if (!fs.existsSync(imagesDir)) {
            fs.mkdirSync(imagesDir);
            console.log(`已创建文件夹: ${folderName}`);
        }

        const { data } = await axios.get(url);
        const $ = cheerio.load(data);

        const imageElements = $('img'); // 选择页面上的所有 img 标签
        const imageUrls = [];

        imageElements.each((index, element) => {
            let imgUrl = $(element).attr('src');

            // 处理相对路径的情况
            if (imgUrl && !imgUrl.startsWith('http')) {
                imgUrl = new URL(imgUrl, url).href;
            }

            if (imgUrl) {
                imageUrls.push(imgUrl);
            }
        });

        console.log(`找到 ${imageUrls.length} 张图片，开始下载...`);

        for (const [index, imageUrl] of imageUrls.entries()) {
            const filename = path.basename(imageUrl);
            await downloadImage(imageUrl, imagesDir, filename);
            console.log(`已下载: ${filename}`);
        }

        console.log('所有图片下载完成');
    } catch (error) {
        console.error('抓取图片时发生错误:', error);
    }
}

// 调用 scrapeImages 函数，传递 URL
const targetUrl = 'https://www.****.com.cn/h-col-115.html';
scrapeImages(targetUrl);