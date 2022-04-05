import SignIn from './src/pages/SignIn';
import SignUp from './src/pages/SignUp';
import Orders from './src/pages/Orders';
import Delivery from './src/pages/Delivery';
import Settings from './src/pages/Settings';
import * as React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {useSelector} from 'react-redux';
import {RootState} from './src/store/reducer';
import useSocket from './src/hooks/useSocket';
import {useEffect} from 'react';
import EncryptedStorage from 'react-native-encrypted-storage';
import axios, {AxiosError} from 'axios';
import Config from 'react-native-config';
import userSlice from './src/slices/user';
import {Alert} from 'react-native';
import {useAppDispatch} from './src/store';
import orderSlice from './src/slices/order';

export type LoggedInParamList = {
  Orders: undefined;
  Settings: undefined;
  Delivery: undefined;
  Complete: {orderId: string};
};

export type RootStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
};

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function AppInner() {
  const dispatch = useAppDispatch();
  const isLoggedIn = useSelector((state: RootState) => !!state.user.email);

  const [socket, disconnect] = useSocket();

  useEffect(() => {
    // 로컬스토리지에서 요청보내기전에 토큰 꺼내서 headers에 넣는 작업
    // axios.interceptors.request.use()

    // 응답
    axios.interceptors.response.use(
      response => {
        console.log('response', response);
        return response;
      }, // 성공
      async error => {
        const {
          config, // 원래 요청이 들어있다.
          response: {status},
        } = error;

        // 토큰 만료
        if (status === 419) {
          // 서버개발자와 약속한 코드
          if (error.response.data.code === 'expired') {
            const originalRequest = config;
            const refreshToken = await EncryptedStorage.getItem('refreshToken');
            const {data} = await axios.post(
              `${Config.API_URL}/refreshToken`,
              {},
              {
                headers: {
                  authorization: `Bearer ${refreshToken}`,
                },
              },
            );
            dispatch(userSlice.actions.setAccessToken(data.data.accessToken));

            // 원래 요청의 headers에 새로운 토큰을 넣어주고 다시 호출
            originalRequest.headers.authorization = `Bearer ${data.data.accessToken}`;
            return axios(originalRequest);
          }

          // 이외의 에러는 에러 처리한다.
          return Promise.reject(error);
        }
      }, // 에러
    );
  }, []);

  useEffect(() => {
    const callback = (data: any) => {
      console.log(data);
      dispatch(orderSlice.actions.addOrder(data));
    };
    if (socket && isLoggedIn) {
      socket.emit('acceptOrder', 'hello');
      socket.on('order', callback);
    }
    return () => {
      if (socket) {
        socket.off('order', callback);
      }
    };
  }, [dispatch, isLoggedIn, socket]);

  useEffect(() => {
    if (!isLoggedIn) {
      console.log('!isLoggedIn', !isLoggedIn);
      disconnect();
    }
  }, [isLoggedIn, disconnect]);

  // 앱 실행 시 토큰 있으면 로그인하는 코드
  useEffect(() => {
    const getTokenAndRefresh = async () => {
      try {
        const token = await EncryptedStorage.getItem('refreshToken');
        if (!token) {
          return;
        }
        const response = await axios.post(
          `${Config.API_URL}/refreshToken`,
          {},
          {
            headers: {
              authorization: `Bearer ${token}`,
            },
          },
        );
        dispatch(
          userSlice.actions.setUser({
            name: response.data.data.name,
            email: response.data.data.email,
            accessToken: response.data.data.accessToken,
          }),
        );
      } catch (error) {
        console.error(error);
        if ((error as AxiosError).response?.data.code === 'expired') {
          Alert.alert('알림', '다시 로그인 해주세요.');
        }
      } finally {
        // TODO: 스플래쉬 스크린 없애기
      }
    };
    getTokenAndRefresh();
  }, [dispatch]);

  return isLoggedIn ? (
    <Tab.Navigator>
      <Tab.Screen
        name="Orders"
        component={Orders}
        options={{title: '오더 목록'}}
      />
      <Tab.Screen
        name="Delivery"
        component={Delivery}
        options={{title: '내 오더'}}
      />
      <Tab.Screen
        name="Settings"
        component={Settings}
        options={{title: '내 정보'}}
      />
    </Tab.Navigator>
  ) : (
    <Stack.Navigator>
      <Stack.Screen
        name="SignIn"
        component={SignIn}
        options={{title: '로그인'}}
      />
      <Stack.Screen
        name="SignUp"
        component={SignUp}
        options={{title: '회원가입'}}
      />
    </Stack.Navigator>
  );
}

export default AppInner;
