// BASE CODE: https://gist.github.com/lemmensaxel/72ece5cd00026cc05888701d7d65fbe0

import {
  ActivityIndicator,
  Button,
  ScrollView,
  Text,
  View,
} from "react-native";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import axios from 'axios';

WebBrowser.maybeCompleteAuthSession();
const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'myapp',
    preferLocalhost: true,
    isTripleSlashed: true,
    useProxy: true,
});

// Keycloak details
const keycloakUri = "https://auth.sgbr.com.br";
const keycloakRealm = "sgbr-hom";
const clientId = "sgmaster-web";

export default function App() {
  const [accessToken, setAccessToken] = useState<string>();
  const [idToken, setIdToken] = useState<string>();
  const [refreshToken, setRefreshToken] = useState<string>();
  const [discoveryResult, setDiscoveryResult] =
    useState<AuthSession.DiscoveryDocument>();
  const [produtos, setProdutos] = useState([]);

  // Fetch OIDC discovery document once
  useEffect(() => {
    const getDiscoveryDocument = async () => {
      const discoveryDocument = await AuthSession.fetchDiscoveryAsync(
        `${keycloakUri}/realms/${keycloakRealm}`
      );
      setDiscoveryResult(discoveryDocument);
    };
    getDiscoveryDocument();
  }, []);

  const login = async () => {
    // Get Authorization code
    const authRequestOptions: AuthSession.AuthRequestConfig = {
      responseType: AuthSession.ResponseType.Code,
      clientId,
      redirectUri: redirectUri,
      prompt: AuthSession.Prompt.Login,
      scopes: ["openid", "profile",],
    };
    const authRequest = new AuthSession.AuthRequest(authRequestOptions);
    const authorizeResult = await authRequest.promptAsync(discoveryResult!, {
      useProxy: true,
    });

    if (authorizeResult.type === "success") {
      // If successful, get tokens
      const tokenResult = await AuthSession.exchangeCodeAsync(
        {
          code: authorizeResult.params.code,
          clientId: clientId,
          redirectUri: redirectUri,
          extraParams: {
            code_verifier: authRequest.codeVerifier || "",
          },
        },
        discoveryResult!
      );

      setProdutos([]);
      setAccessToken(tokenResult.accessToken);
      setIdToken(tokenResult.idToken);
      setRefreshToken(tokenResult.refreshToken);
    }
  };

  const refresh = async () => {
    const refreshTokenObject: AuthSession.RefreshTokenRequestConfig = {
      clientId: clientId,
      refreshToken: refreshToken,
    };
    const tokenResult = await AuthSession.refreshAsync(
      refreshTokenObject,
      discoveryResult!
    );

    setProdutos([]);
    setAccessToken(tokenResult.accessToken);
    setIdToken(tokenResult.idToken);
    setRefreshToken(tokenResult.refreshToken);
  };

  const logout = async () => {
    if (!accessToken) return;
    const revoked = await AuthSession.revokeAsync(
      { token: accessToken },
      discoveryResult!
    );
    if (!revoked) return;

    // The default revokeAsync method doesn't work for Keycloak, we need to explicitely invoke the OIDC endSessionEndpoint with the correct parameters
    const logoutUrl = `${discoveryResult!
      .endSessionEndpoint!}?client_id=${clientId}&post_logout_redirect_uri=${redirectUri}&id_token_hint=${idToken}`;

    const res = await WebBrowser.openAuthSessionAsync(logoutUrl, redirectUri);
    if (res.type === "success") {
      setProdutos([]);
      setAccessToken(undefined);
      setIdToken(undefined);
      setRefreshToken(undefined);
    }
  };

  function getProdutos() {
    axios.get('https://thiago.hom.sgmw.com.br/api/produto', {
        headers: {"Authorization": "Bearer " + accessToken}
    }).then(res => {
        setProdutos(res.data)
    })
  }

  if (!discoveryResult) return <ActivityIndicator />;

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      {refreshToken ? (
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <View style={{ height: 100 }}>
            <ScrollView style={{ flex: 1, gap: 4 }}>
              <Text>AccessToken: {accessToken}</Text>
              <Text>idToken: {idToken}</Text>
              <Text>refreshToken: {refreshToken}</Text>
            </ScrollView>
          </View>
          { produtos.length > 0 && <View style={{ height: 100, marginTop: 100 }}>
            <ScrollView style={{ flex: 1 }}>
                <Text>PRODUTOS:</Text>
                {produtos.map((produto, index) => {
                    if(index < 10){
                        return (<Text key={index}>{produto.descricaoCodigo}</Text>);
                    }
                })}
            </ScrollView>
          </View>}
          <View>
            <Button title="Refresh" onPress={refresh} />
            <Button title="Logout" onPress={logout} />
            <Button title="Produtos" onPress={getProdutos} />
          </View>
        </View>
      ) : (
        <Button title="Login" onPress={login} />
      )}
    </View>
  );
}