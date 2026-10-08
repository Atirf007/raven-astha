/* ============================================================
   EVAH OPHIM — Azure Integration (azure.js)
   Microsoft Entra ID (Azure AD), Azure SQL Database, Blob Storage
   ============================================================ */

const AzureConfig = {
  // ═══════════════════════════════════════════════════════════
  // [LINK] CONFIGURAÇÃO AZURE — Preencha com suas credenciais
  // ═══════════════════════════════════════════════════════════

  // Microsoft Entra ID (Azure AD)
  auth: {
    tenantId: 'YOUR_TENANT_ID',            // Portal Azure > Azure AD > Overview > Tenant ID
    clientId: 'YOUR_CLIENT_ID',            // App Registrations > Your App > Application (client) ID
    clientSecret: 'YOUR_CLIENT_SECRET',    // Backend only — NEVER expose in frontend
    authority: 'https://login.microsoftonline.com/YOUR_TENANT_ID',
    redirectUri: window.location.origin + '/evah/login.html',
    postLogoutRedirectUri: window.location.origin,
    scopes: ['openid', 'profile', 'email', 'User.Read'],
  },

  // Azure SQL Database
  database: {
    server: 'YOUR_SERVER.database.windows.net',
    database: 'evah_ophim_db',
    port: 1433,
    // Connection string template for backend (Node.js with mssql package):
    // `Server=tcp:${server},${port};Initial Catalog=${database};Persist Security Info=False;
    //  User ID=${username};Password=${password};MultipleActiveResultSets=False;
    //  Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;`
    //
    // Or with Managed Identity (recommended):
    // `Server=tcp:${server},${port};Initial Catalog=${database};
    //  Authentication=Active Directory Managed Identity;Encrypt=True;`
  },

  // Azure Blob Storage
  storage: {
    accountName: 'YOUR_STORAGE_ACCOUNT',
    containerImages: 'material-images',
    containerManuals: 'material-manuals',
    containerDocuments: 'documents',
    // SAS token template (generate in Azure Portal or via SDK)
    // sasToken: '?sv=2022-11-02&ss=b&srt=sco&sp=rwdlaciytfx&se=...'
  },

  // Azure Application Insights (telemetry)
  insights: {
    instrumentationKey: 'YOUR_INSTRUMENTATION_KEY',
    connectionString: 'InstrumentationKey=YOUR_KEY;IngestionEndpoint=https://brazilsouth-1.in.applicationinsights.azure.com/'
  }
};

// ── MSAL Configuration for Entra ID ──
// In production, install @azure/msal-browser via npm
const MSALConfig = {
  auth: {
    clientId: AzureConfig.auth.clientId,
    authority: AzureConfig.auth.authority,
    redirectUri: AzureConfig.auth.redirectUri,
    postLogoutRedirectUri: AzureConfig.auth.postLogoutRedirectUri,
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      logLevel: 3, // Error
    }
  }
};

// ── Azure Integration Layer ──
const AzureIntegration = {
  msalInstance: null, // Set after MSAL import

  // ── Initialize MSAL ──
  async init() {
    // In production with MSAL installed:
    // const { PublicClientApplication } = require('@azure/msal-browser');
    // this.msalInstance = new PublicClientApplication(MSALConfig);
    // await this.msalInstance.initialize();
    console.log('[Azure] MSAL config ready. Install @azure/msal-browser for production.');
    console.log('[Azure] Tenant:', AzureConfig.auth.tenantId);
    console.log('[Azure] Client:', AzureConfig.auth.clientId);
  },

  // ── Entra ID Login ──
  async loginWithEntraID() {
    if (this.msalInstance) {
      try {
        const loginResponse = await this.msalInstance.loginPopup({
          scopes: AzureConfig.auth.scopes
        });
        return { success: true, account: loginResponse.account, token: loginResponse.accessToken };
      } catch (error) {
        console.error('[Azure] Login error:', error);
        return { success: false, error: error.message };
      }
    }
    // Mock for beta
    console.log('[Azure] Mock Entra ID login (install MSAL for production)');
    return { success: true, account: { name: 'Azure User', username: 'user@company.onmicrosoft.com' }, token: 'mock_entra_token' };
  },

  // ── Get Access Token (for API calls) ──
  async getAccessToken(scopes = ['api://YOUR_API_CLIENT_ID/.default']) {
    if (this.msalInstance) {
      const accounts = this.msalInstance.getAllAccounts();
      if (accounts.length === 0) return null;
      try {
        const response = await this.msalInstance.acquireTokenSilent({ scopes, account: accounts[0] });
        return response.accessToken;
      } catch {
        const response = await this.msalInstance.acquireTokenPopup({ scopes });
        return response.accessToken;
      }
    }
    return 'mock_access_token';
  },

  // ── Azure SQL via Backend API ──
  db: {
    async query(endpoint, method = 'GET', body = null) {
      const token = await AzureIntegration.getAccessToken();
      const config = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      };
      if (body) config.body = JSON.stringify(body);
      try {
        const res = await fetch(`${Auth.API_BASE}/azure${endpoint}`, config);
        return await res.json();
      } catch (err) {
        console.error('[Azure DB]', err);
        return { error: err.message };
      }
    },

    // Materials CRUD
    getMaterials() { return this.query('/materials'); },
    getMaterial(code) { return this.query(`/materials/${code}`); },
    createMaterial(data) { return this.query('/materials', 'POST', data); },
    updateMaterial(code, data) { return this.query(`/materials/${code}`, 'PUT', data); },
    deleteMaterial(code) { return this.query(`/materials/${code}`, 'DELETE'); },

    // Movements
    getMovements() { return this.query('/movements'); },
    createEntry(data) { return this.query('/movements/entry', 'POST', data); },
    createExit(data) { return this.query('/movements/exit', 'POST', data); },

    // Users & Permissions
    getUsers() { return this.query('/users'); },
    updateUserRole(userId, role) { return this.query(`/users/${userId}/role`, 'PUT', { role }); },
  },

  // ── Azure Blob Storage ──
  storage: {
    getImageUrl(filename) {
      return `https://${AzureConfig.storage.accountName}.blob.core.windows.net/${AzureConfig.storage.containerImages}/${filename}`;
    },
    getManualUrl(filename) {
      return `https://${AzureConfig.storage.accountName}.blob.core.windows.net/${AzureConfig.storage.containerManuals}/${filename}`;
    },
    async uploadImage(file) { return this._upload(file, AzureConfig.storage.containerImages); },
    async uploadManual(file) { return this._upload(file, AzureConfig.storage.containerManuals); },
    async _upload(file, container) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('container', container);
      try {
        const res = await fetch(`${Auth.API_BASE}/azure/storage/upload`, { method: 'POST', body: formData });
        return await res.json();
      } catch (err) {
        return { error: err.message };
      }
    }
  },

  // ── Health Check ──
  async checkHealth() {
    try {
      const res = await fetch(`${Auth.API_BASE}/azure/health`);
      return await res.json();
    } catch { return { status: 'offline' }; }
  }
};

/*
  ═══════════════════════════════════════════════════════════
  AZURE SQL DATABASE SCHEMA (execute no Azure Portal)
  ═══════════════════════════════════════════════════════════

  CREATE TABLE Materials (
    Code NVARCHAR(20) PRIMARY KEY,
    Description NVARCHAR(200) NOT NULL,
    Model NVARCHAR(100),
    Brand NVARCHAR(100),
    Sector NVARCHAR(50),
    Location NVARCHAR(20),
    Quantity INT DEFAULT 0,
    MinStock INT DEFAULT 0,
    MaxStock INT DEFAULT 0,
    UnitPrice DECIMAL(10,2) DEFAULT 0,
    ImageUrl NVARCHAR(500),
    MachineryName NVARCHAR(200),
    MachineryImage NVARCHAR(500),
    UsageDescription NVARCHAR(2000),
    ManufacturerUrl NVARCHAR(500),
    ManualUrl NVARCHAR(500),
    MapLevel INT,
    MapShelf INT,
    MapPosition INT,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    UpdatedAt DATETIME2 DEFAULT GETDATE()
  );

  CREATE TABLE Movements (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    MaterialCode NVARCHAR(20) FOREIGN KEY REFERENCES Materials(Code),
    Operation NVARCHAR(20),
    Quantity INT,
    UnitPrice DECIMAL(10,2),
    Responsible NVARCHAR(200),
    CreatedAt DATETIME2 DEFAULT GETDATE()
  );

  CREATE TABLE Users (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    Name NVARCHAR(100) NOT NULL,
    Email NVARCHAR(200) UNIQUE NOT NULL,
    PasswordHash NVARCHAR(500),
    Role NVARCHAR(20) DEFAULT 'viewer',
    Provider NVARCHAR(20) DEFAULT 'local',
    AzureOid NVARCHAR(100),
    CreatedAt DATETIME2 DEFAULT GETDATE()
  );

  CREATE TABLE CustomComponents (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    Name NVARCHAR(200) NOT NULL,
    Description NVARCHAR(2000),
    CreatedBy INT FOREIGN KEY REFERENCES Users(Id),
    CreatedAt DATETIME2 DEFAULT GETDATE()
  );

  CREATE TABLE ComponentMaterials (
    ComponentId INT FOREIGN KEY REFERENCES CustomComponents(Id),
    MaterialCode NVARCHAR(20) FOREIGN KEY REFERENCES Materials(Code),
    Quantity INT DEFAULT 1,
    PRIMARY KEY (ComponentId, MaterialCode)
  );
*/

window.AzureIntegration = AzureIntegration;
window.AzureConfig = AzureConfig;
