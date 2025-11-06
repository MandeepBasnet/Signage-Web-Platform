import axios from "axios";
let token = null;

export async function getAccessToken() {
  if (token) return token;

  const res = await axios.post(
    `${process.env.XIBO_API_URL}/authorize/access_token`,
    {
      client_id: process.env.XIBO_CLIENT_ID,
      client_secret: process.env.XIBO_CLIENT_SECRET,
      grant_type: "client_credentials",
    }
  );
  token = res.data.access_token;
  setTimeout(() => (token = null), res.data.expires_in * 900);
  return token;
}

export async function xiboRequest(endpoint, method = "GET", data = null) {
  const accessToken = await getAccessToken();
  const res = await axios({
    method,
    url: `${process.env.XIBO_API_URL}${endpoint}`,
    headers: { Authorization: `Bearer ${accessToken}` },
    data,
  });
  return res.data;
}
