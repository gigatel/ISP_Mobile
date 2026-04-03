import React, {useCallback, useState, useRef, useEffect} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Alert,
  Platform,
  ActivityIndicator,
  Linking,
  Image,
  ImageStyle,
} from 'react-native';
import {Screen} from '@organisms';
import {
  useRoute,
  useNavigation,
  useFocusEffect,
} from '@react-navigation/native';
import {BackHeader} from '@molecules';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RouteProp} from '@react-navigation/native';
import {RootStackParamList} from '@navigation/navigator';
import {Common} from '@utils';
import {COLORS, FONTS, SIZE, STYLES, IMAGES} from '@res';
import {TicketData, TicketDetailsData} from '../../types/ticket.types';
import {useTicketDetails} from '../../hooks/tickets/useTicketDetails';
import {
  Padding,
  BoxShadow,
  Border,
  Gap,
  LetterSpacing,
  Height,
  Width,
  LineHeight,
  FontFamily,
  FontSize,
  Opacity,
} from '../../res/globalStyle';
import LinearGradient from 'react-native-linear-gradient';
const mapDetailsToTicketData = (
  d: TicketDetailsData,
  comingFrom: 'COMPLAINTS' | 'TASKS',
): TicketData => ({
  id: d.id,
  ticketNo: d.transactionNo,
  transactionNo: d.transactionNo,
  description: d.remark,
  assignedDate: d.createdDate,
  priority: d.priority as 'high' | 'medium' | 'low',
  status: d.status as TicketData['status'],

  customerName: d.customerName,
  customerMobile: d.contactPersonMobile,

  ticketType: comingFrom === 'TASKS' ? 'task' : 'complaint',

  circuitFrom: d.circuitFrom,
  circuitTo: d.circuitTo,
  circuitId: d.circuitId,

  assignedTo: d.assignedTo,
  assignedBy: d.assignedBy,

  contactPersonName: d.contactPersonName,
  contactPersonMobile: d.contactPersonMobile,

  natureOfFault: d.natureOfFault,
  modeOfComplaint: d.modeOfComplaint ?? '',
  otdrLength: d.otdrLength ?? '',
  remark: d.remark,

  isStarted: d.isStarted,

  ticketEndTime: d.ticketEndTime ?? '',

  startTime: null,
  endTime: null,

  rawData: {} as any,
  formData: {} as any,
});

type TicketDetailsRouteProp = RouteProp<RootStackParamList, 'TicketDetails'>;
type TicketDetailsNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'TicketDetails'
>;

const TicketDetailsScreen: React.FC = () => {
  const route = useRoute<TicketDetailsRouteProp>();
  const navigation = useNavigation<TicketDetailsNavigationProp>();
  const hasFocusedOnce = useRef(false);
  const firstLoadRef = useRef(true);

  const handleBackPress = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const {ticketId, comingFrom} = route.params as {
    ticketId: string;
    comingFrom: 'COMPLAINTS' | 'TASKS';
  };

  const isTicketClosed = (ticket: any): boolean => {
    const status = ticket?.status?.toLowerCase();
    return (
      status === 'closed' || status === 'completed' || !!ticket?.ticketEndTime
    );
  };

  const isTicketCompletedOrClosed = (ticket: any): boolean => {
    const status = ticket?.status?.toLowerCase();
    return status === 'closed' || status === 'completed';
  };
  const getFirstName = (name?: string) => {
    if (!name) return 'N/A';
    return name.trim().split(' ')[0];
  };
  const safeComingFrom = comingFrom === 'TASKS' ? 'TASKS' : 'COMPLAINTS';
  const initialTab: 'TICKET_DETAILS' = 'TICKET_DETAILS';
  const [activeTab, setActiveTab] = useState<
    'TICKET_DETAILS' | 'CONTACT_DETAILS' | 'CHAMBER_DETAILS'
  >(initialTab);

  const {
    ticketDetails,
    followUps,
    routeRows,
    error,
    loading,
    routeAddressMap,
    refetch,
  } = useTicketDetails(ticketId);

  const getTaskTypeFromTicket = (ticketDetails: any): string => {
    /**
     * Get task type from ticket details
     * @param {any} ticketDetails - Ticket details object
     * @returns {string} Task type
     */
    if (ticketDetails?.taskType) {
      return ticketDetails.taskType;
    }
    const fields = ticketDetails?.formData?.fields;
    if (Array.isArray(fields)) {
      const taskField = fields.find((f: any) => f.fieldKey === 'task_list');
      if (taskField?.value) return taskField.value;
    }
    return ticketDetails?.taskGroupName || '';
  };

  const hasChambers = Array.isArray(routeRows) && routeRows.length > 0;

  const renderChamberDetails = () => {
    if (!Array.isArray(routeRows) || routeRows.length === 0) {
      return (
        <View style={{padding: SIZE.MS(16)}}>
          <Text style={{color: COLORS.ERROR, textAlign: 'center'}}>
            No chamber data found
          </Text>
        </View>
      );
    }
    return (
      <View
        style={{
          backgroundColor: 'transparent',
          marginTop: SIZE.MVS(10),
          paddingHorizontal: SIZE.MS(12),
        }}>
        <View style={styles.frameParent3}>
          {routeRows.map((routeObj, index) => {
            const chambers = [...(routeObj.route_chambers || [])].sort(
              (a, b) => (a.order_no ?? 0) - (b.order_no ?? 0),
            );

            if (!chambers.length) return null;

            const start = chambers[0];
            const end = chambers[chambers.length - 1];

            const address =
              routeAddressMap?.[routeObj.route_id] ||
              start.chamber_address ||
              'Address not available';

            return (
              <View
                key={`route-${routeObj.route_id}-${index}`}
                style={[
                  styles.frameWrapper3,
                  styles.frameWrapperShadowBox,
                  {
                    paddingVertical: SIZE.MVS(12),
                    paddingHorizontal: SIZE.MS(12),
                    borderRadius: SIZE.MS(10),
                    marginBottom: SIZE.MVS(10),
                  },
                ]}>
                <View style={{flexDirection: 'row', alignItems: 'flex-start'}}>
                  {/* Left Icon */}
                  <Image
                    source={IMAGES.mapNew}
                    style={{
                      width: SIZE.MS(24),
                      height: SIZE.MS(24),
                      marginRight: SIZE.MS(10),
                      marginTop: SIZE.MVS(2),
                    }}
                    resizeMode="contain"
                  />
                  {/* Right Content */}
                  <View style={{flex: 1}}>
                    <Text
                      style={[
                        styles.gig28alakBatra249alaknanda,
                        {fontSize: SIZE.MS(13), lineHeight: SIZE.MVS(18)},
                      ]}>
                      {routeObj.route_id}
                      {routeObj.route_name ? ` (${routeObj.route_name})` : ''} (
                      {start.chamber_id} ({start.chamber_name}) To{' '}
                      {end.chamber_id} ({end.chamber_name}))
                    </Text>
                    <Text
                      style={[
                        styles.nearAlaknandaMarket,
                        {
                          marginTop: SIZE.MVS(4),
                          fontSize: SIZE.MS(12),
                          paddingRight: SIZE.MS(12),
                          lineHeight: SIZE.MVS(16),
                        },
                      ]}>
                      {address}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (firstLoadRef.current) {
        firstLoadRef.current = false;
        return;
      }
      console.log('🔄 Back to TicketDetails → refetch');
      refetch();
    });
    return unsubscribe;
  }, [navigation, refetch]);
  const formatDate = (dateStr: string): string => {
    if (!dateStr) {
      return '';
    }
    try {
      const date = new Date(dateStr);
      const day = String(date.getDate()).padStart(2, '0');
      const months = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ];
      const month = months[date.getMonth()];
      const year = date.getFullYear();
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${day} ${month} ${year} ${hours}:${minutes}`;
    } catch {
      return dateStr;
    }
  };
  const handleViewOnMap = () => {
    if (!routeRows?.length) return;
    navigation.navigate('ChamberDetails', {
      routeRows: routeRows,
      routeAddressMap: routeAddressMap,
    });
  };

  const handleStart = () => {
    if (ticketDetails?.isStarted) {
      Common.showToast('Ticket already started');
      return;
    }
    Alert.alert('Start Ticket', 'Are you sure?', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Start',
        onPress: () => {
          Common.success('Ticket started');
          navigation.navigate('StartTicketScreen', {
            ticketId,
            ticketData: mapDetailsToTicketData(ticketDetails!),
          });
        },
      },
    ]);
  };

  const renderFollowUpHistory = () => {
    console.log('📋 Rendering Follow-ups:', followUps);

    if (!followUps || followUps.length === 0) {
      return (
        <View style={styles.contactDetailsCard}>
          <View style={styles.contactCardHeader}>
            <Text style={styles.contactCardTitle}>Follow-up History</Text>
          </View>
          <View style={styles.contactCardContent}>
            <Text style={styles.contactCardValue}>No follow-ups yet</Text>
          </View>
        </View>
      );
    }

    return (
      <>
        {followUps.map((followUp, index) => (
          <View
            key={index}
            style={[
              styles.frameSpaceBlock1Bottom,
              index > 0 && {marginTop: SIZE.MVS(12)}, // ✅ GAP BETWEEN RED BLOCKS
            ]}>
            <View style={styles.profileContainer}>
              <Image source={IMAGES.ProfileIcon} style={styles.vectorIcon} />
              <Text style={styles.employeeTxt}>
                by : {getFirstName(followUp?.employeeName)}
              </Text>
            </View>
            {/* CHAMBER */}
            {followUp.chamberName && (
              <View style={[styles.col, styles.colFlexBox]}>
                <View style={[styles.chamberParent, styles.frameParentFlexBox]}>
                  <Text style={styles.remarksTypo}>Chamber</Text>
                  <View style={[styles.frameChild8, styles.frameChildBg1]} />
                </View>
                <Text style={[styles.loremIpsumIsSimply, styles.oldIrTypo]}>
                  {followUp.chamberIdStr || ''} - {followUp.chamberName || ''}
                </Text>
              </View>
            )}
            {/* REMARK */}
            {followUp.remark && (
              <View style={[styles.col, styles.colFlexBox]}>
                <View style={[styles.chamberParent, styles.frameParentFlexBox]}>
                  <Text style={styles.remarksTypo}>Remark</Text>
                  <View style={[styles.frameChild8, styles.frameChildBg1]} />
                </View>
                <Text
                  style={[styles.gignet4p24250949Alaknand, styles.oldIrTypo]}>
                  {followUp.remark}
                </Text>
              </View>
            )}{' '}
            {followUp.address && (
              <View style={[styles.col, styles.colFlexBox]}>
                <View style={[styles.chamberParent, styles.frameParentFlexBox]}>
                  <Text style={styles.remarksTypo}>Address</Text>
                  <View style={[styles.frameChild8, styles.frameChildBg1]} />
                </View>
                <Text
                  style={[styles.gignet4p24250949Alaknand, styles.oldIrTypo]}>
                  {followUp.address}
                </Text>
              </View>
            )}
          </View>
        ))}
      </>
    );
  };

  const handleOldIR = () => {
    console.log('ticketDetails', ticketDetails);
    if (!ticketDetails?.irAttachment) {
      Alert.alert('Old IR', 'No IR found', [
        {
          text: 'OK',
          onPress: () => Common.showToast('No IR found'),
        },
      ]);
      return;
    }
    Linking.openURL(ticketDetails?.irAttachment);
  };

  const handleNewIR = async () => {
    navigation.navigate('ChamberDetailsScreen', {
      customerName: ticketDetails?.customerName || '',
      circuitName: ticketDetails?.circuitId || '',
    });
  };

  const handleUpdate = () => {
    navigation.navigate('StartTicketScreen', {
      ticketId,
      ticketData: mapDetailsToTicketData(ticketDetails!),
    });
  };

  const handleClose = () => {
    Alert.alert('Close Ticket', 'Are you sure you want to close this ticket?', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Close',
        onPress: () => {
          navigation.navigate('CloseTicketScreen', {
            ticketId,
            ticketData: mapDetailsToTicketData(ticketDetails!),
            comingFrom, // ✅ THIS IS THE FIX
          });
        },
      },
    ]);
  };

  /*************  ✨ Windsurf Command ⭐  *************/
  /**
   * Returns a color based on the given priority.
   * @param {string} priority The priority of the ticket. Can be 'high', 'medium', or 'low'.
   * @returns {string} A color string corresponding to the given priority.
   */
  /*******  490f5a73-96cb-4f0e-97c7-62a0d54c28b3  *******/
  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'high':
        return COLORS.ERROR;
      case 'medium':
        return COLORS.WARNING;
      case 'low':
        return COLORS.SUCCESS;
      default:
        return COLORS.TEXT_MEDIUM;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'assigned':
        return COLORS.WARNING;
      case 'started':
        return COLORS.PRIMARY;
      case 'completed':
        return COLORS.SUCCESS;
      default:
        return COLORS.TEXT_MEDIUM;
    }
  };

  const getTaskLocation = (ticketDetails: any): string => {
    if (ticketDetails?.field_1) return ticketDetails.field_1;
    if (ticketDetails?.location) return ticketDetails.location;
    return '';
  };

  const renderTicketDetailsTab = () => {
    const isTask = comingFrom === 'TASKS';
    console.log('ticketDetailsData:', {ticketDetails});
    return (
      <View style={[styles.frameParent3, styles.frameSpaceBlock]}>
        {/* ✅ WHITE CONTAINER: Customer to Status */}
        <View style={styles.whiteDetailsContainer}>
          {/* Customer */}
          <View style={[styles.customerParent, styles.parentFlexBox1]}>
            <Text style={styles.remarksTypo}>Customer</Text>
            <Text style={[styles.StyleNew, styles.oldIrTypo]}>
              {ticketDetails?.customerName}
            </Text>
          </View>

          <View style={[styles.frameChild2, styles.frameChildBg]} />

          {/* Circuit ID */}
          <View style={[styles.customerParent, styles.parentFlexBox1]}>
            <Text style={styles.remarksTypo}>Circuit ID</Text>
            <Text style={[styles.StyleNew, styles.oldIrTypo]}>
              {ticketDetails?.circuitId}
            </Text>
          </View>

          <View style={[styles.frameChild2, styles.frameChildBg]} />

          {/* Task Type (only for TASKS) */}
          {isTask && (
            <>
              <View style={[styles.customerParent, styles.parentFlexBox1]}>
                <Text style={styles.remarksTypo}>Task Type</Text>
                <Text style={[styles.StyleNew, styles.oldIrTypo]}>
                  {getTaskTypeFromTicket(ticketDetails) ||
                    ticketDetails?.taskGroupName ||
                    'N/A'}
                </Text>
              </View>
              <View style={[styles.frameChild2, styles.frameChildBg]} />
            </>
          )}

          {/* Route - From */}
          <View style={[styles.customerParent, styles.parentFlexBox1]}>
            <Text style={styles.remarksTypo}>Route - From</Text>
            <Text style={[styles.StyleNew, styles.oldIrTypo]}>
              {ticketDetails?.circuitFrom}
            </Text>
          </View>

          <View style={[styles.frameChild2, styles.frameChildBg]} />

          {/* To */}
          <View style={[styles.customerParent, styles.parentFlexBox1]}>
            <Text style={styles.remarksTypo}>To</Text>
            <Text style={[styles.StyleNew, styles.oldIrTypo]}>
              {ticketDetails?.circuitTo}
            </Text>
          </View>
          <View style={[styles.frameChild2, styles.frameChildBg]} />

          {/* OTDR From (only for COMPLAINTS) */}
          {!isTask && (
            <>
              <View style={[styles.customerParent, styles.parentFlexBox1]}>
                <Text style={styles.remarksTypo}>OTDR From</Text>
                <Text style={[styles.StyleNew, styles.oldIrTypo]}>
                  {ticketDetails?.otdrFrom}
                </Text>
              </View>
            </>
          )}

          <View style={[styles.frameChild2, styles.frameChildBg]} />
          {/* ✅ Bottom Row: OTDR Value, Fault, Status */}
          <View style={styles.frameParent5}>
            {!isTask && (
              <View style={[styles.faultParent, styles.parentFlexBox1]}>
                <Text style={styles.remarksTypo}>OTDR Value</Text>
                <View style={[styles.vectorGroup, styles.vectorParentFlexBox]}>
                  <Text style={[styles.text, styles.ticketTypo]}>
                    {ticketDetails?.otdrLength}
                  </Text>
                </View>
              </View>
            )}
            <View style={[styles.faultParent, styles.parentFlexBox1]}>
              <Text style={styles.remarksTypo}>Fault</Text>
              <View style={[styles.vectorGroup, styles.vectorParentFlexBox]}>
                <Image
                  style={styles.vectorIcon2}
                  source={IMAGES.downArrow}
                  resizeMode="cover"
                />
                <Text style={[styles.linkDown, styles.oldIrTypo]}>
                  {ticketDetails?.natureOfFault}
                </Text>
              </View>
            </View>
            <View style={[styles.faultParent, styles.parentFlexBox1]}>
              <Text style={[styles.remarksTypo]}>Status</Text>
              <View style={[styles.vectorGroup, styles.vectorParentFlexBox]}>
                <Text style={[styles.oldIrTypo, {color: '#ca961d'}]}>
                  {ticketDetails?.status}
                </Text>
              </View>
            </View>
          </View>
          <View style={[styles.frameChild2, styles.frameChildBg]} />

          <View style={styles.frameParent6}>
            <View style={[styles.frameInner, styles.frameBg]} />
            <View style={[styles.nocRemarkParent, styles.parentSpaceBlock]}>
              <Text style={[styles.remarks, styles.remarksTypo]}>Remarks</Text>
              <Text style={[styles.StyleNew, styles.oldIrTypo]}>
                {ticketDetails?.remark}
              </Text>
            </View>
            <View style={[styles.frameChild2, styles.frameBg]} />
            <View style={[styles.nocRemarkParent, styles.parentSpaceBlock]}>
              <Text style={styles.remarksTypo}>NOC Remarks</Text>
              <Text style={[styles.StyleNew, styles.oldIrTypo]}>
                {ticketDetails?.nocRemark || 'N/A'}
              </Text>
            </View>
            <View style={[styles.frameChild2, styles.frameBg]} />
            <View style={[styles.nocRemarkParent, styles.parentSpaceBlock]}>
              <Text style={styles.remarksTypo}>RFO</Text>
              <Text style={[styles.StyleNew, styles.oldIrTypo]}>
                {ticketDetails?.rfo}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  };
  const renderContactDetailsTab = () => (
    <View style={[styles.frameWrapper4, styles.wrapperShadowBox]}>
      <View style={styles.inner}>
        <View style={[styles.frameParent5, styles.parentFlexBox]}>
          <View style={[styles.frameWrapper6, styles.frameFlexBox1]}>
            <View style={styles.avatarContainer}>
              <View style={styles.initialContainer}>
                <Text style={styles.initialText}>
                  {ticketDetails?.contactPersonName?.[0]}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.shubhamDobriyalParent}>
            <Text style={[styles.shubhamDobriyal3, styles.textTypo]}>
              {ticketDetails?.contactPersonName}
            </Text>
            <View style={[styles.vectorContainer, styles.frameFlexBox1]}>
              <Image
                source={IMAGES.telephoneIcon}
                style={styles.vectorIcon3}
                resizeMode="cover"
              />
              <Text style={[styles.text, styles.textTypo]}>
                {ticketDetails?.contactPersonMobile}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar backgroundColor={COLORS.PRIMARY} barStyle="light-content" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY} />
          <Text style={styles.loadingText}>Loading ticket details...</Text>
        </View>
      </SafeAreaView>
    );
  }
  if (error || !ticketDetails) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar backgroundColor={COLORS.PRIMARY} barStyle="light-content" />
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>G</Text>
            </View>
            <Text style={styles.headerTitle}>Ticket Details</Text>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.networkIndicator} />
          </View>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            {error || 'Ticket details not found'}
          </Text>
          <TouchableOpacity style={styles.retryBtn} onPress={refetch}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
  return (
    <View style={styles.container}>
      <StatusBar backgroundColor={COLORS.PRIMARY} barStyle="light-content" />
      <View style={styles.headerWrapper}>
        <BackHeader
          headerTitle="Ticket Details"
          onBackPress={handleBackPress}
        />
        <View style={styles.frameSpaceBlock1}>
          <View style={styles.inner}>
            <View style={[styles.frameContainer, styles.frameSpaceBlock]}>
              <View style={[styles.vectorParent, styles.vectorParentFlexBox]}>
                <Image source={IMAGES.Tickets} style={styles.vectorIcon} />

                <Text style={[styles.c08350, styles.c08350FlexBox]}>
                  {ticketDetails.transactionNo}
                </Text>
              </View>
              <Text style={[styles.jul20251826, styles.c08350FlexBox]}>
                {formatDate(ticketDetails.createdDate)}
              </Text>
              <View style={styles.rectangleParent}>
                <View style={[styles.groupChild, styles.groupChildLayout]} />
                <View style={[styles.groupItem, styles.groupChildLayout]} />
                <View style={[styles.groupInner, styles.groupChildLayout]} />
                <View style={[styles.rectangleView, styles.groupChildLayout]} />
                <View style={[styles.groupChild2, styles.groupChildLayout]} />
                <View style={[styles.groupChild3, styles.groupChildLayout]} />
                <View style={[styles.groupChild4, styles.groupChildLayout]} />
                <View style={[styles.groupChild5, styles.groupChildLayout]} />
              </View>
            </View>
          </View>
          <View style={{flexDirection: 'row', marginTop: SIZE.MS(8)}}>
            <Text style={[styles.asgByTypo]}>{`Asg by : `}</Text>
            <Text style={[styles.shubhamDobriyal]}>
              {ticketDetails.assignedBy}
            </Text>
          </View>
        </View>
      </View>
      {/* ✅ FIXED TABS */}
      <View style={styles.tabsSection}>
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'TICKET_DETAILS' && styles.activeTab,
            ]}
            onPress={() => setActiveTab('TICKET_DETAILS')}>
            <Text
              style={[
                styles.tabText,
                activeTab === 'TICKET_DETAILS' && styles.activeTabText,
              ]}>
              Ticket Details
            </Text>
          </TouchableOpacity>

          {comingFrom === 'COMPLAINTS' && (
            <TouchableOpacity
              style={[
                styles.tab,
                activeTab === 'CONTACT_DETAILS' && styles.activeTab,
              ]}
              onPress={() => setActiveTab('CONTACT_DETAILS')}>
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'CONTACT_DETAILS' && styles.activeTabText,
                ]}>
                Contact Details
              </Text>
            </TouchableOpacity>
          )}
          {comingFrom === 'TASKS' && (
            <TouchableOpacity
              style={[
                styles.tab,
                activeTab === 'CHAMBER_DETAILS' && styles.activeTab,
              ]}
              onPress={() => setActiveTab('CHAMBER_DETAILS')}>
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'CHAMBER_DETAILS' && styles.activeTabText,
                ]}>
                Chamber Details
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ✅ SCROLLABLE CONTENT WITH PROPER BOTTOM PADDING */}
      <ScrollView
        style={styles.scrollableContent}
        contentContainerStyle={styles.scrollableContentContainer}
        showsVerticalScrollIndicator={false}>
        {/* Tab Content */}
        {activeTab === 'TICKET_DETAILS' && renderTicketDetailsTab()}
        {activeTab === 'CONTACT_DETAILS' &&
          comingFrom === 'COMPLAINTS' &&
          renderContactDetailsTab()}
        {activeTab === 'CHAMBER_DETAILS' && comingFrom === 'TASKS' && (
          <View style={{backgroundColor: COLORS.BACKGROUND_DEFAULT}}>
            {renderChamberDetails()}
          </View>
        )}

        {/* IR Buttons */}
        {activeTab !== 'CHAMBER_DETAILS' && activeTab !== 'CONTACT_DETAILS' && (
          <View style={styles.irButtonsContainer}>
            <TouchableOpacity style={styles.irButton} onPress={handleOldIR}>
              <Text style={styles.irButtonText}>OLD IR</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.irButtonSecondary}
              onPress={handleNewIR}>
              <Text style={styles.irButtonSecondaryText}>
                NEW IR ( UPDATE CORE )
              </Text>
            </TouchableOpacity>
          </View>
        )}
        {/* Status Change Section */}
        {activeTab !== 'CHAMBER_DETAILS' && activeTab !== 'CONTACT_DETAILS' && (
          <View style={styles.statusChangeSection}>
            <Text style={styles.statusChangeTitle}>
              Change ticket status below
            </Text>

            <View style={styles.statusButtons}>
              <TouchableOpacity
                style={[
                  styles.statusBtn,
                  styles.startBtn,
                  (ticketDetails.isStarted ||
                    ticketDetails.status === 'closed' ||
                    ticketDetails.status === 'Task Complete') &&
                    styles.disabledBtn,
                ]}
                onPress={handleStart}
                disabled={
                  ticketDetails.isStarted ||
                  ticketDetails.status === 'closed' ||
                  ticketDetails.status === 'Task Complete'
                }>
                <Image
                  source={IMAGES.StartArrow}
                  style={styles.playSolidFull1Icon}
                />
                <Text style={styles.statusBtnText}>START</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.statusBtn,
                  styles.updateBtn,
                  (!ticketDetails.isStarted ||
                    ticketDetails.status === 'closed' ||
                    ticketDetails.status === 'Task Complete') &&
                    styles.disabledBtn,
                ]}
                disabled={
                  !ticketDetails.isStarted ||
                  ticketDetails.status === 'closed' ||
                  ticketDetails.status === 'Task Complete'
                }
                onPress={handleUpdate}>
                <Image
                  source={IMAGES.UpdateNew}
                  style={styles.playSolidFull1Icon}
                />
                <Text style={styles.statusBtnText}>UPDATE</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.statusBtn,
                  styles.closeBtn,
                  (!ticketDetails.isStarted ||
                    ticketDetails.status === 'closed' ||
                    ticketDetails.status === 'Task Complete') &&
                    styles.disabledBtn,
                ]}
                disabled={
                  !ticketDetails.isStarted ||
                  ticketDetails.status === 'closed' ||
                  ticketDetails.status === 'Task Complete'
                }
                onPress={handleClose}>
                <Image
                  source={IMAGES.CloseNew}
                  style={styles.playSolidFull1Icon}
                />
                <Text style={styles.statusBtnText}>CLOSE</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        {/* ✅ EMPLOYEE FOLLOW-UP CARD - Now properly visible above buttons */}
        {/* {activeTab === 'TICKET_DETAILS' && ( */}
        {/* )} */}
        {activeTab === 'TICKET_DETAILS' && renderFollowUpHistory()}
        {/* ✅ Extra bottom spacing to ensure content is fully visible */}
      </ScrollView>
      {/* ✅ FIXED MAP BUTTON FOR CHAMBER DETAILS TAB */}
      {activeTab === 'CHAMBER_DETAILS' &&
        comingFrom === 'TASKS' &&
        hasChambers && (
          <TouchableOpacity
            style={[
              styles.fixedViewOnMapBtn,
              routeRows.length === 1 && styles.singleChamberMapBtn,
            ]}
            onPress={handleViewOnMap}>
            <Text style={styles.fixedViewOnMapText}>VIEW ON MAP</Text>
          </TouchableOpacity>
        )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.WHITE,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.PRIMARY, // ❌ yellow hata diya
    paddingHorizontal: SIZE.MS(16),
    paddingVertical: SIZE.MVS(12),
    ...(Platform.OS === 'android'
      ? {elevation: 4}
      : {
          shadowColor: '#000',
          shadowOffset: {width: 0, height: 2},
          shadowOpacity: 0.25,
          shadowRadius: 3.84,
        }),
  },
  backButton: {
    padding: SIZE.MS(8),
  },
  backText: {
    color: COLORS.WHITE,
    fontSize: SIZE.MS(20),
    fontWeight: 'bold',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // disabled: {
  //   backgroundColor: COLORS.DISABLED,
  // },
  tabsSection: {
    paddingHorizontal: SIZE.MS(16),
    paddingTop: SIZE.MVS(60),
    backgroundColor: 'transparent',
    zIndex: 10,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#E0E6E9',
    borderRadius: SIZE.MS(10),
    paddingHorizontal: SIZE.MS(1.5),
    paddingVertical: SIZE.MS(1.5),
  },
  logo: {
    width: SIZE.MS(28),
    height: SIZE.MS(28),
    borderRadius: SIZE.MS(14),
    backgroundColor: COLORS.WARNING,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SIZE.MS(8),
  },
  ticketTypo: {
    fontSize: FontSize.fs_14,
    textAlign: 'left',
    fontFamily: FONTS.SEMI_BOLD,
    backgroundColor: '#ACACAC57',
    paddingHorizontal: SIZE.MS(12),
    paddingVertical: SIZE.MVS(4),
    borderRadius: SIZE.MS(6),
  },
  logoText: {
    color: COLORS.TEXT_DARKER,
    fontSize: SIZE.MS(16),
    fontWeight: 'bold',
  },
  frameWrapper4: {
    paddingTop: Padding.padding_4, // 👈 kam kiya
    paddingHorizontal: Padding.padding_8,
    borderRadius: Border.br_6,
    alignSelf: 'stretch',
    backgroundColor: 'transparent',
  },
  frameWrapper6: {
    paddingTop: SIZE.MVS(2), // 👈 pehle 6 tha
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  vectorContainer: {
    gap: 7,
    flexDirection: 'row',
    justifyContent: 'center',
    alignSelf: 'stretch',
    // paddingBottom: 12,
  },
  frameWrapperShadowBox: {
    backgroundColor: COLORS.WHITE,
    borderRadius: SIZE.MS(10),
    ...(Platform.OS === 'android'
      ? {elevation: 3}
      : {
          shadowColor: '#000',
          shadowOffset: {width: 0, height: 2},
          shadowOpacity: 0.2,
          shadowRadius: 3,
        }),
  },
  vectorIcon3: {
    width: 12,
    height: Height.height_12,
  },
  employeeTxt: {
    color: COLORS.WHITE,
    fontSize: FontSize.fs_12,
    fontFamily: FONTS.SEMI_BOLD,
  },
  shubhamDobriyalParent: {
    marginTop: SIZE.MVS(10),
    gap: 4,
    alignSelf: 'stretch',
    backgroundColor: 'transparent',
  },
  shubhamDobriyal3: {
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  headerTitle: {
    fontWeight: '500',
    fontSize: SIZE.MVS(12),
    fontFamily: FONTS.MEDIUM,
    color: COLORS.colorDarkslategray,
    textAlign: 'left',
  },
  frameWrapper3: {
    padding: Padding.padding_10,
    borderRadius: SIZE.MS(10),
    alignSelf: 'stretch',
    marginBottom: SIZE.MVS(10),
  },
  headerRight: {
    width: SIZE.MS(32),
    alignItems: 'flex-end',
  },
  frameFlexBox1: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  wrapperShadowBox: {
    backgroundColor: 'transparent',
    boxShadow: BoxShadow.shadow_drop,
  },
  textTypo: {
    fontSize: FontSize.fs_14,
    color: COLORS.colorDarkslategray,
    fontFamily: FONTS.MEDIUM,
  },
  text: {
    color: COLORS.colorDarkslategray100,
    lineHeight: LineHeight.lh_14,
    letterSpacing: LetterSpacing.ls_0_2,
    fontWeight: '500',
  },
  frameChild8: {
    flex: 1,
  },
  frameChildBg1: {
    backgroundColor: COLORS.colorWhitesmoke300,
    height: Height.height_1,
  },
  profileContainer: {
    backgroundColor: COLORS.colorMediumslateblue,
    flexDirection: 'row',
    alignSelf: 'flex-start',
    paddingVertical: SIZE.MVS(6),
    paddingHorizontal: SIZE.MS(8),
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: SIZE.MS(20),
    marginBottom: SIZE.MVS(8),
  },
  networkIndicator: {
    width: SIZE.MS(8),
    height: SIZE.MS(8),
    borderRadius: SIZE.MS(4),
    backgroundColor: COLORS.SUCCESS,
  },
  scrollableContent: {
    flex: 1,
  },
  scrollableContentContainer: {
    paddingBottom: SIZE.MVS(24), // ✅ INCREASED PADDING to prevent content hiding
  },
  gig28alakBatra249alaknandaParent: {
    flex: 1,
  },

  gig28alakBatra249alaknanda: {
    color: COLORS.colorDarkslategray100,
    fontSize: SIZE.MS(13),
    lineHeight: SIZE.MVS(18),
    fontFamily: FONTS.SEMI_BOLD,
  },

  nearAlaknandaMarket: {
    color: COLORS.colorDarkslategray200,
    fontSize: SIZE.MS(12),
    lineHeight: SIZE.MVS(16),
    fontFamily: FONTS.LIGHT,
    marginTop: SIZE.MVS(4),
  },

  iconImage: {
    height: SIZE.MS(20),
    width: SIZE.MS(20),
    resizeMode: 'contain',
  },
  singleChamberMapBtn: {
    left: SIZE.MS(16),
    right: SIZE.MS(16),
    bottom: SIZE.MVS(12),
    borderRadius: SIZE.MS(12),
  },
  headerWrapper: {
    backgroundColor: COLORS.PRIMARY,
    paddingBottom: SIZE.MVS(28),
  },
  tab: {
    flex: 1,
    paddingVertical: SIZE.MVS(12),
    borderRadius: SIZE.MS(10),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E0E6E9',
  },
  activeTab: {
    backgroundColor: COLORS.WHITE,
  },
  tabText: {
    fontSize: FontSize.fs_13,
    color: COLORS.colorDarkslategray,
    fontFamily: FONTS.SEMI_BOLD,
  },
  activeTabText: {
    fontSize: SIZE.MS(14),
    fontFamily: FONTS.MEDIUM,
    color: COLORS.colorDarkslategray,
    textAlign: 'left',
    fontWeight: 'bold',
  },
  tabContent: {
    backgroundColor: COLORS.WHITE,
    minHeight: SIZE.MVS(200),
  },
  whiteDetailsContainer: {
    backgroundColor: COLORS.WHITE,
    borderRadius: Border.br_6,
    padding: Padding.padding_12,
    gap: Gap.gap_8,
    ...(Platform.OS === 'android'
      ? {elevation: 3}
      : {
          shadowColor: '#000',
          shadowOffset: {width: 0, height: 2},
          shadowOpacity: 0.18,
          shadowRadius: 3,
        }),
  },
  irButtonsContainer: {
    flexDirection: 'row',
    paddingHorizontal: SIZE.MS(16),
    paddingVertical: SIZE.MVS(4),
    backgroundColor: COLORS.WHITE,
    marginTop: SIZE.MVS(8),
    gap: SIZE.MS(12),
  },
  irButton: {
    paddingHorizontal: SIZE.MS(24),
    backgroundColor: COLORS.colorDarkorange,
    paddingVertical: SIZE.MVS(12),
    borderRadius: SIZE.MS(8),
    alignItems: 'center',
  },
  irButtonText: {
    color: COLORS.WHITE,
    fontSize: FontSize.fs_12,
    fontFamily: FONTS.SEMI_BOLD,
  },
  irButtonSecondary: {
    paddingHorizontal: SIZE.MS(24),
    backgroundColor: COLORS.colorMediumaquamarine,
    paddingVertical: SIZE.MVS(12),
    borderRadius: SIZE.MS(8),
    alignItems: 'center',
  },
  irButtonSecondaryText: {
    color: COLORS.WHITE,
    fontSize: SIZE.MS(11),
    fontWeight: 'bold',
  },
  statusChangeSection: {
    backgroundColor: COLORS.WHITE,
    paddingHorizontal: SIZE.MS(16),
    paddingBottom: SIZE.MVS(16),
    marginTop: SIZE.MVS(8),
  },
  statusChangeTitle: {
    fontSize: FontSize.fs_14,
    color: COLORS.TEXT_DARKER,
    marginBottom: SIZE.MVS(16),
    fontFamily: FONTS.REGULAR,
  },
  statusButtons: {
    flexDirection: 'row',
    gap: SIZE.MS(10),
  },
  statusBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SIZE.MVS(12),
    borderRadius: SIZE.MS(8),
  },
  startBtn: {
    backgroundColor: COLORS.colorLimegreen,
  },
  updateBtn: {
    backgroundColor: COLORS.colorGold,
  },
  closeBtn: {
    backgroundColor: COLORS.colorCrimson,
  },
  disabledBtn: {
    backgroundColor: COLORS.DISABLED,
  },
  statusBtnText: {
    color: COLORS.WHITE,
    fontSize: FontSize.fs_12,
    fontFamily: FONTS.SEMI_BOLD,
  },
  contactDetailsCard: {
    backgroundColor: COLORS.WHITE,
    marginTop: SIZE.MVS(16),
    borderColor: COLORS.WHITE,
    paddingVertical: SIZE.MVS(8),
  },
  contactCardHeader: {
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: SIZE.MS(16),
    paddingVertical: SIZE.MVS(8),
    borderTopLeftRadius: SIZE.MS(6),
    borderTopRightRadius: SIZE.MS(6),
  },
  contactCardTitle: {
    color: COLORS.WHITE,
    fontSize: SIZE.MS(12),
    fontWeight: 'bold',
  },
  col: {
    alignSelf: 'stretch',
  },
  colFlexBox: {
    gap: Gap.gap_4,
    justifyContent: 'center',
  },
  contactCardContent: {
    padding: SIZE.MS(16),
  },
  contactCardValue: {
    fontSize: SIZE.MS(11),
    color: COLORS.TEXT_DARK,
    lineHeight: SIZE.MS(16),
  },
  bottomSpacing: {
    height: SIZE.MVS(80),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.BACKGROUND_DEFAULT,
  },
  frameChild: {
    height: SIZE.MVS(30),
    width: SIZE.MVS(20),
    marginHorizontal: SIZE.MS(10),
    resizeMode: 'contain',
  },
  loadingText: {
    marginTop: SIZE.MS(12),
    color: COLORS.TEXT_MEDIUM,
    fontSize: SIZE.MS(16),
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.BACKGROUND_DEFAULT,
    paddingHorizontal: SIZE.MS(32),
  },
  errorText: {
    color: COLORS.TEXT_MEDIUM,
    fontSize: SIZE.MS(16),
    textAlign: 'center',
    marginBottom: SIZE.MVS(16),
  },
  retryBtn: {
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: SIZE.MS(24),
    paddingVertical: SIZE.MVS(12),
    borderRadius: SIZE.MS(8),
  },
  retryText: {
    color: COLORS.WHITE,
    fontSize: SIZE.MS(14),
    fontWeight: 'bold',
  },
  fixedViewOnMapBtn: {
    position: 'absolute',
    bottom: 10,
    left: 18,
    right: 18,
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 10,
    paddingVertical: SIZE.MVS(16),
    alignItems: 'center',

    ...(Platform.OS === 'android'
      ? {elevation: 6}
      : {
          shadowColor: '#000',
          shadowOffset: {width: 0, height: -2},
          shadowOpacity: 0.25,
          shadowRadius: 4,
        }),
  },
  fixedViewOnMapText: {
    color: COLORS.WHITE,
    fontSize: SIZE.MS(16),
    fontFamily: FONTS.SEMI_BOLD,
  },
  parent: {
    flex: 1,
  },
  frameParentFlexBox: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: SIZE.MVS(8),
  },
  frameSpaceBlock1Bottom: {
    flexDirection: 'column',
    paddingHorizontal: Padding.padding_8,
    paddingVertical: Padding.padding_16,
    borderRadius: Border.br_6,
    elevation: 3,
    marginHorizontal: SIZE.MS(15),
    backgroundColor: COLORS.WHITE,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.12,
    shadowRadius: 4,
  },
  frameSpaceBlock1: {
    position: 'absolute',
    bottom: -SIZE.MVS(50),
    flexDirection: 'column',
    paddingBottom: Padding.padding_10,
    paddingHorizontal: Padding.padding_8,
    paddingTop: Padding.padding_8,
    backgroundColor: COLORS.colorWhite,
    borderRadius: Border.br_6,
    elevation: 3,
    width: '92%',
    alignSelf: 'center',
    boxShadow: BoxShadow.shadow_drop,
  },
  c08350Layout: {
    lineHeight: LineHeight.lh_14,
    letterSpacing: LetterSpacing.ls_0_2,
  },
  frameSpaceBlock: {
    padding: Padding.padding_8,
    alignSelf: 'stretch',
  },
  vectorParentFlexBox: {
    gap: Gap.gap_6,
    alignItems: 'center',
    flexDirection: 'row',
  },
  c08350FlexBox: {
    textAlign: 'left',
    letterSpacing: LetterSpacing.ls_0_2,
  },
  groupChildLayout: {
    transform: [
      {
        rotate: '180deg',
      },
    ],
    height: Height.height_2,
    borderRadius: Border.br_50,
    left: 2,
    width: Width.width_2,
    backgroundColor: COLORS.colorWhite,
    position: 'absolute',
  },
  asgByTypo: {
    fontSize: FontSize.fs_13,
    lineHeight: LineHeight.lh_14,
    letterSpacing: LetterSpacing.ls_0_2,
    fontFamily: FONTS.SEMI_BOLD,
  },
  oldIrTypo: {
    fontSize: FontSize.fs_14,
    textAlign: 'left',
    fontFamily: FONTS.MEDIUM,
    color: COLORS.colorDarkslategray,
  },
  parentFlexBox: {
    gap: Gap.gap_2,
    justifyContent: 'center',
    backgroundColor: 'transparent',
    flexDirection: 'column',
    borderRadius: 12,
  },
  parentFlexBox1: {
    gap: Gap.gap_4,
    justifyContent: 'center',
  },
  remarksTypo: {
    color: '#393d45',
    textAlign: 'left',
    fontSize: FontSize.fs_12,
    fontFamily: FONTS.REGULAR,
  },
  frameChildBg: {
    borderColor: COLORS.colorWhitesmoke300,
    borderWidth: 1,
    height: Height.height_1,
    width: 'auto',
  },
  frameBg: {
    backgroundColor: COLORS.colorGainsboro200,
    height: Height.height_1,
  },
  parentSpaceBlock: {
    paddingVertical: Padding.padding_12,
    paddingHorizontal: Padding.padding_0,
    gap: Gap.gap_4,
    justifyContent: 'center',
  },
  inner: {
    alignSelf: 'stretch',
  },
  frameContainer: {
    borderRadius: 4,
    backgroundColor: COLORS.colorPalegoldenrod,
    justifyContent: 'space-between',
    gap: 20,
    minHeight: 32,
    alignItems: 'center',
    flexDirection: 'row',
  },
  vectorParent: {
    zIndex: 0,
    justifyContent: 'center',
  },
  vectorIcon: {
    width: 20,
    height: 20,
    marginRight: 8,
    resizeMode: 'contain',
  } as ImageStyle,
  c08350: {
    color: COLORS.colorDarkslategray100,
    lineHeight: LineHeight.lh_14,
    fontSize: FontSize.fs_12,
    textAlign: 'left',
    fontFamily: FONTS.SEMI_BOLD,
  },
  jul20251826: {
    color: COLORS.colorDarkslategray100,
    fontSize: FontSize.fs_12,
    textAlign: 'left',
    fontFamily: FONTS.SEMI_BOLD,
    zIndex: 1,
  },
  rectangleParent: {
    height: 30,
    top: 1,
    left: 200,
    zIndex: 2,
    width: Width.width_2,
    position: 'absolute',
  },
  groupChild: {
    top: 0,
  },
  groupItem: {
    top: 4,
  },
  groupInner: {
    top: 8,
  },
  rectangleView: {
    top: 12,
  },
  groupChild2: {
    top: 16,
  },
  groupChild3: {
    top: 20,
  },
  groupChild4: {
    top: 24,
  },
  groupChild5: {
    top: 28,
  },
  asgBy: {
    opacity: 0.7,
    color: COLORS.colorDarkslategray100,
  },
  shubhamDobriyal: {
    color: COLORS.colorMediumslateblue,
    fontWeight: '500',
    fontSize: FontSize.fs_13,
    fontFamily: FONTS.SEMI_BOLD,
  },
  frameParent3: {
    backgroundColor: 'transparent',
    marginHorizontal: SIZE.MS(12),
    borderRadius: Border.br_6,
    flex: 1,
  },
  frameParent4: {
    flex: 1,
    minHeight: 60,
    flexDirection: 'column',
    gap: Gap.gap_8,
    backgroundColor: COLORS.WHITE,

    alignItems: 'center',
  },
  customerParent: {
    alignSelf: 'stretch',
  },
  customer: {
    height: Height.height_16,
    display: 'flex',
    // color: COLORS.colorDarkslategray200,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  gigatelSolutionsPrivateLimiWrapper: {
    alignSelf: 'stretch',
  },
  gigatelSolutionsPrivate: {
    color: COLORS.colorDarkslategray100,
  },
  StyleNew: {
    color: COLORS.colorDarkslategray100,
    alignSelf: 'stretch',
  },
  frameParent5: {
    gap: SIZE.MVS(4), // 👈 pehle Gap.gap_8 tha
    flexDirection: 'row',
    alignSelf: 'stretch',
    backgroundColor: 'transparent',
    justifyContent: 'center',
  },
  faultParent: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  vectorGroup: {
    justifyContent: 'flex-start',
    alignSelf: 'stretch',
    minHeight: SIZE.MVS(32),
  },
  vectorIcon2: {
    height: 13,
    width: 9,
  },
  linkDown: {
    color: COLORS.colorIndianred,
    lineHeight: LineHeight.lh_14,
    letterSpacing: LetterSpacing.ls_0_2,
    fontSize: FontSize.fs_14,
    fontWeight: '500',
    flex: 1,
  },
  frameParent6: {
    paddingVertical: Padding.padding_0,
    borderRadius: Border.br_6,
    alignSelf: 'stretch',
  },
  remarks: {
    display: 'flex',
    opacity: Opacity.opacity_0_8,
    color: COLORS.colorDarkslategray200,
    alignItems: 'center',
    alignSelf: 'stretch',
    flex: 1,
  },
  loremIpsumIsSimply: {
    lineHeight: LineHeight.lh_20,
    color: COLORS.colorDarkslategray100,
    alignSelf: 'stretch',
  },
  frameInner: {
    display: 'none',
    width: 366,
  },
  nocRemarkParent: {
    alignSelf: 'stretch',
  },
  frameChild2: {
    alignSelf: 'stretch',
  },
  playSolidFull1Icon: {
    height: 18,
    width: 18,
    marginRight: SIZE.MS(6),
  },
  chamberParent: {
    gap: Gap.gap_10,
    alignSelf: 'stretch',
  },
  gignet4p24250949Alaknand: {
    color: COLORS.colorDarkslategray100,
    alignSelf: 'stretch',
  },
  avatarContainer: {
    width: SIZE.MS(80), // 👈 pehle 100
    height: SIZE.MS(80),
    borderRadius: SIZE.MS(40),
    overflow: 'hidden',
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SIZE.MVS(4), // 👈 new
  },
  initialContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.PRIMARY_LIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  initialText: {
    fontFamily: FONTS.BOLD,
    fontSize: SIZE.MVS(22),
    color: COLORS.PRIMARY_DARK,
    textTransform: 'uppercase',
  },
});
export default TicketDetailsScreen;
