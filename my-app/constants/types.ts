// types.ts
export type RootStackParamList = {
  Welcome: undefined;
  AddTrip: undefined;
  AddFriends: undefined;
  Debt: undefined;
  Notification: undefined;
  Trip: { tripId: string } | undefined;
  FriendProfile: { userId: string } | undefined;
};
