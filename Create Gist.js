// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: brown; icon-glyph: file-code;
// To use this script, you need to configure an OAuth App on GitHub.
// Follow the instructions on the link below to create your OAuth App.
//
// When you are asked to put in a redirect URL, you should put the URL for running this script in Scriptable. Assuming the name of this script is "Create Gist", the URL is scriptable:///run?scriptName=Create%20Gist
//
// https://developer.github.com/apps/building-oauth-apps/creating-an-oauth-app/
//
// Now that you have an app, you can run this script. The script will prompt you to enter the client ID and client secret you got after creating the app on GitHub.

// Keychain key for the GitHub OAuth App client ID
let CLIENT_ID_KEY = "github.gists.clientId"
// Keychain key for the GitHub OAuth App client secret
let CLIENT_SECRET_KEY = "github.gists.clientSecret"
// Keychain key for the access token
let ACCESS_TOKEN_KEY = "github.gists.accessToken"

let params = args.queryParameters
if (params.error_description) {
  // Received error during OAuth flow.
  let error = decodeURIComponent(params.error_description.replace(/\+/g, " "))
  presentErrorAlert("OAuth Error", error)
} else if (params.filename != null && params.content != null && params.description != null && params.public != null) {
  // Create a gist using the parameters in the URL scheme.
  await postUsingURLScheme(params)
} else if (params.code != null) {
  // Exchange code to an access token and present the main menu.
  await exchangeCode(params.code)
  await presentMenu()
} else if (Keychain.contains(ACCESS_TOKEN_KEY)) {
  // Present the main menu.
  await presentMenu()
} else {
  // Prompt to enter the client ID and client secret and then start the authorization flow.
  await promptForClientCredentials()
  authorize()
}

// Creates a gist from URL scheme parameters. If x-callback-url parameters are provided, the function will switch to the calling app after creating the gist.
async function postUsingURLScheme(params) {
  let xSuccess = params["x-success"]
  let xError = params["x-error"]
  if (Keychain.contains(ACCESS_TOKEN_KEY)) {    
    let accessToken = Keychain.get(ACCESS_TOKEN_KEY)
    try {
      let gist = await postGist(
        accessToken, 
        params.filename, 
        decodeURIComponent(params.content),
        params.description,
        params.public)
      if (xSuccess != null) {
        let url = xSuccess
          + "?gistURL=" + encodeURIComponent(gist.html_url)
        Safari.open(url)
      }
    } catch(err) {
      if (xError != null) {
        let url = xError
          + "?code=-1"
          + "&errorMessage=" + encodeURIComponent(err)
        Safari.open(url)
      } else {
        presentErrorAlert("Failed Creating Gist", err)
      }
    }
  } else {
    let msg = "Cannot create a gist using the URL scheme because you have not granted the script access to your gists. Run the script from Scriptable to grant authorization."
    if (xError != null) {
      let url = xError
        + "?code=-1"
        + "&errorMessage=" + encodeURIComponent(msg)
      Safari.open(url)
    } else {
      presentErrorAlert("Unauthorized", msg)
    }
  }
}

// Presents the main menu.
async function presentMenu() {
  let alert = new Alert()
  alert.addAction("Select File")
  alert.addAction("Select Script")
  alert.addDestructiveAction("Remove Credentials")
  alert.addCancelAction("Cancel")
  let idx = await alert.presentAlert()
  if (idx == 0) {
    let filePath = await pickFile()
    if (filePath != null) {
      await updateOrCreateGistWithFile(filePath)
    }
  } else if (idx == 1) {
    let filePath = await pickScript()
    if (filePath != null) {
      await updateOrCreateGistWithFile(filePath)
    }
  } else if (idx == 2) {
     await confirmRemoveCredentials() 
  }
}

// Updates an existing gist or creates a new one depending on what the user chooses to do.
async function updateOrCreateGistWithFile(filePath) {
  let shouldUpdate = await askIfGistShouldBeUpdated()
  if (shouldUpdate) {
    let gist = await pickGist()
    await updateGistWithFile(gist, filePath)
  } else {
    await createGistWithFile(filePath)
  }
}

// Called after a gist have been created or updated.
// Asks the user what to do with the link to the gist.
async function showGistPostedAlert(title, url) {
  let alert = new Alert()
  alert.title = title
  alert.addAction("👀 View Gist")
  alert.addAction("📎 Copy Link")
  alert.addCancelAction("Cancel")
  let idx = await alert.present()
  if (idx == 0) {
    Safari.open(url)
  } else if (idx == 1) {
    Pasteboard.copy(url)
  }
}

// Asks if a gist should be public or private.
async function askIfGistShouldBePublic() {
  let alert = new Alert()
  alert.addAction("🌎 Public")
  alert.addAction("🔒 Private")
  alert.addCancelAction("Cancel") 
  let idx = await alert.presentAlert()
  if (idx == -1) {
    throw new Error("Cancelled flow")
  } else if (idx == 0) {
    return true
  } else if (idx == 1) {
    return false
  }
}

// Asks if an existing Gist should be updated 
// or if a new gist should be created.
async function askIfGistShouldBeUpdated() {
  let alert = new Alert()
  alert.addAction("➕ Create New Gist")
  alert.addAction("✨ Update Existing Gist")
  alert.addCancelAction("Cancel") 
  let idx = await alert.presentAlert()
  if (idx == -1) {
    throw new Error("Cancelled flow")
  } else if (idx == 0) {
    return false
  } else if (idx == 1) {
    return true
  }
}

// Asks the user if they really want to remove the stored credentials.
async function confirmRemoveCredentials() {
  let alert = new Alert()
  alert.title = "Remove Credentials"
  alert.message = "Are you sure you want to remove the credentials from your keychain? If you remove the credentials, you'll need to enter your client ID and client secret the next time you run the script."
  alert.addDestructiveAction("Yes, remove credentials")
  alert.addCancelAction("Cancel")
  let idx = await alert.presentAlert()
  if (idx == 0) {
    removeCredentials()
  }
}

// Presents a list to pick a gist from
async function pickGist() {
  let gists = await loadGists()
  let pickedGist = null
  let table = new UITable()
  table.showSeparators = true
  for (let gist of gists) {
    let filenames = Object.keys(gist.files).join(", ")
    let title = null
    if (gist.public) {
      title = "🌎 " + filenames
    } else {
      title = "🔒 " + filenames
    }
    let url = gist.html_url
    let row = new UITableRow()    
    let titleCell = row.addText(title)
    let buttonCell = row.addButton("View")
    buttonCell.rightAligned()
    titleCell.widthWeight = 90
    buttonCell.widthWeight = 10
    buttonCell.onTap = () => {
      Safari.open(url)
    }
    row.height = 50
    row.dismissOnSelect = true
    row.onSelect = (idx) => {
      pickedGist = gists[idx]
    }
    table.addRow(row)
  }
  await table.present()
  if (pickedGist != null) {
    return pickedGist
  } else {
    throw new Error("Cancelled picking gist")
  }
}

// Presents the document picker and returns the file path to the picked file.
async function pickFile() {
  let paths = await DocumentPicker.open(["public.plain-text"])
  if (paths.length > 0) {
    return paths[0]
  } else {
    throw new Error("Cancelled picking file")
  }
}

// Presents a list of all Scriptable scripts and returns the path to the picked script.
async function pickScript() {
  let fm = FileManager.iCloud()
  let dir = fm.documentsDirectory()
  let filenames = fm.listContents(dir)
  let jsFilePaths = filenames.filter(filename => {
    let uti = fm.getUTI(filename)
    return uti == "com.netscape.javascript-source"
  }).map(filename => {
    return fm.joinPath(dir, filename)
  }).sort()
  let selectedFilePath = null
  let table = new UITable()
  table.showSeparators = true
  for (filepath of jsFilePaths) {
    let filename = fm.fileName(filepath)
    let row = new UITableRow()
    row.height = 50
    row.addText(filename)
    table.addRow(row)
    row.onSelect = (idx) => {
      selectedFilePath = jsFilePaths[idx]
    }
    row.dismissOnSelect = true 
  }
  await table.present()
  if (selectedFilePath != null) {
    return selectedFilePath
  } else {
    throw new Error("Cancelled picking script")
  }
}

// Reads a file and creates a gist with its content.
async function createGistWithFile(filePath) {
  let accessToken = Keychain.get(ACCESS_TOKEN_KEY)
  let fm = FileManager.local()
  let content = fm.readString(filePath)
  let filename = fm.fileName(filePath, true)
  let description = await promptForValue(
    "Enter Description",
    "Describe your Gist", 
    "Description",
    null)
  let public = await askIfGistShouldBePublic()
  let gist = await postGist(accessToken, filename, content, description, public)
  await showGistPostedAlert("Gist Created", gist.html_url)
}

// Updates an existing gist to include the specified file.
// If the file already exists in the gist, it is updated, otherwise it is added. All other files are removed.
async function updateGistWithFile(gist, filePath) {
  let accessToken = Keychain.get(ACCESS_TOKEN_KEY)
  let files = {}
  let filenames = Object.keys(gist.files)
  for (let filename of filenames) {
    files[filename] = null
  }
  let fm = FileManager.local()
  let content = fm.readString(filePath)
  let filename = fm.fileName(filePath, true)
  files[filename] = {
    "content": content
  }
  let body = {
    "files": files
  }
  let url = "https://api.github.com/gists/" + gist.id
  let req = new Request(url)
  req.method = "PATCH"
  req.headers = {
    "Authorization": "Bearer " + accessToken,
    "Accept": "application/json"
  }
  req.body = JSON.stringify(body)
  await req.loadJSON()
  await showGistPostedAlert("Gist Updated", gist.html_url)
}

// Loads all gists of the authenticated user
async function loadGists() {
  let accessToken = Keychain.get(ACCESS_TOKEN_KEY)
  let url = "https://api.github.com/gists"
  let req = new Request(url)
  req.headers = {
    "Authorization": "Bearer " + accessToken,
    "Accept": "application/json"
  }
  return await req.loadJSON()
}

// Creates a new gist using the GitHub API.
async function postGist(accessToken, filename, content, description, public) {
  let files = {}
  files[filename] = {
    "content": content
  }
  let body = {
    "description": description,
    "public": public,
    "files": files
  }
  let url = "https://api.github.com/gists"
  let req = new Request(url)
  req.method = "POST"
  req.body = JSON.stringify(body)
  req.headers = {
    "Authorization": "Bearer " + accessToken,
    "Accept": "application/json"
  }
  return await req.loadJSON()
}

// Presents Safari to initiate an OAuth flow. 
async function authorize() {
  let clientId = Keychain.get(CLIENT_ID_KEY)
  let redirectURL = "scriptable:///run?scriptName=" + Script.name()
  let scope = "gist"
  let baseURL = "https://github.com/login/oauth/authorize"
  let url = baseURL 
    + "?client_id=" + encodeURIComponent(clientId)
    + "&redirect_uri=" + encodeURIComponent(redirectURL)
    + "&scope=" + scope
  Safari.open(url)
}

// Exchanges an OAuth code to an access token using the GitHub API and stores the access token in the keychain.
async function exchangeCode(code) {
  let clientId = Keychain.get(CLIENT_ID_KEY)
  let clientSecret = Keychain.get(CLIENT_SECRET_KEY)
  let baseURL = "https://github.com/login/oauth/access_token"
  let url = baseURL 
    + "?client_id=" + encodeURIComponent(clientId)
    + "&client_secret=" + encodeURIComponent(clientSecret)
    + "&code=" + encodeURIComponent(code)
  let req = new Request(url)
  req.method = "POST"
  req.headers = {
    "Accept": "application/json"
  }
  let res = await req.loadJSON()
  let accessToken = res.access_token
  Keychain.set(ACCESS_TOKEN_KEY, accessToken)
}

// Prompts the user to enter the client ID and client secret.
async function promptForClientCredentials() {
  let clientId = await promptForValue(
    "Client ID",
    "Paste the client ID of your GitHub OAuth App in here. You received the client ID after creating the OAuth app on GitHub.",
    "Client ID",
    null)
  let clientSecret = await promptForValue(
    "Client Secret",
    "Paste the client secret of your GitHub OAuth App in here. You received the client secret after creating the OAuth app on GitHub.",
    "Client secret",
    null)
  Keychain.set(CLIENT_ID_KEY, clientId)
  Keychain.set(CLIENT_SECRET_KEY, clientSecret)
  // We might as well remove the access token because it's not valid when the client have been changed.
  if (Keychain.contains(ACCESS_TOKEN_KEY)) {
    Keychain.remove(ACCESS_TOKEN_KEY)
  }
}

// Removes all stored credentials.
function removeCredentials() {
  Keychain.remove(CLIENT_ID_KEY)
  Keychain.remove(CLIENT_SECRET_KEY)
  Keychain.remove(ACCESS_TOKEN_KEY)
}

// Presents an alert where the user can enter a value in a text field.
// Returns the entered value.
async function promptForValue(title, message, placeholder, value) {
  let alert = new Alert()
  alert.title = title
  alert.message = message
  alert.addTextField(placeholder, value)
  alert.addAction("OK")
  alert.addCancelAction("Cancel")
  let idx = await alert.present()
  if (idx != -1) {
    return alert.textFieldValue(0)
  } else {
    throw new Error("Cancelled entering value")
  }
}

// Presents an alert with a cancel button.
async function presentErrorAlert(title, message) {
  let alert = new Alert()
  alert.title = title
  alert.message = message
  alert.addCancelAction("Cancel")
  await alert.presentAlert()
}