require("dotenv").config();
const { Configuration, OpenAIApi } = require("openai");

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

const generateMessage = async (prompt, callback) => {
  try {
    const response = await openai.createCompletion({
      model: "text-davinci-003",
      prompt: prompt,
      max_tokens: 50,
      n: 1,
      stop: null,
      temperature: 0.7,
    });

    const message = response.data.choices[0].text.trim();
    callback(null, message);
  } catch (error) {
    callback(error, null);
  }
};

module.exports = {
  generateMessage,
};