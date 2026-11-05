import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChatBubbleLeftRightIcon, ExclamationTriangleIcon, MicrophoneIcon, PhoneXMarkIcon, VideoCameraIcon, VideoCameraSlashIcon } from '@heroicons/react/24/outline';
import { mediaErrorGuide } from '@/renewal/domain/chat';
import { DataError, data } from '@/renewal/data';
import { useChatRooms, useMe, useVideoChannel } from '@/renewal/data/queries';
import { Avatar, Badge, Button, ErrorState, LoadingState, buttonClassName, toast } from '@/renewal/ui';
import { MissingRedirect } from '@/renewal/screens/system';
import { useWritable } from '@/renewal/shell/useWritable';
import { errorMessage } from '@/renewal/features/teamSpace/TaskModals';

type MediaState = { status: 'idle' | 'loading' } | { status: 'ready'; stream: MediaStream } | { status: 'error'; title: string; description: string } | { status: 'skipped' };

/** 카메라·마이크를 연다. 지원하지 않는 환경(http 등)도 같은 안내 경로로 보낸다. */
const openMedia = async (): Promise<MediaStream> => {
  if (!navigator.mediaDevices?.getUserMedia) throw new DOMException('getUserMedia unavailable', 'UnsupportedError');
  return navigator.mediaDevices.getUserMedia({ video: true, audio: true });
};

const stopStream = (stream?: MediaStream) => stream?.getTracks().forEach((track) => track.stop());

const MediaToggle: React.FC<{ on: boolean; label: string; onIcon: React.ReactNode; offIcon: React.ReactNode; disabled?: boolean; onClick: () => void }> = ({ on, label, onIcon, offIcon, disabled, onClick }) => (
  <button
    type="button"
    aria-pressed={on}
    aria-label={`${label} ${on ? '끄기' : '켜기'}`}
    disabled={disabled}
    onClick={onClick}
    className={`inline-flex h-12 w-12 items-center justify-center rounded-full border transition-colors disabled:opacity-40 ${on ? 'border-outline-soft bg-surface text-ink' : 'border-transparent bg-danger text-white'}`}
  >
    {on ? onIcon : offIcon}
  </button>
);

/**
 * SCR-VID-01 화상회의(15 §4.3, §5.4). 들어가기 전에 카메라·마이크를 확인하고, 거부되면 할 일을 안내한다(US-15-07).
 * 장치 없이도 참여할 수 있다. 나가면 참여 기록을 지우고 팀 스페이스로 돌아간다.
 * 실제 영상 연결은 LiveKit이 맡으며 토큰은 응답 본문으로만 받는다(15-D5). 목업에서는 다른 참여자의 영상이 없다.
 */
export const VideoScreen: React.FC = () => {
  const { wsId = '', channelId = '' } = useParams<{ wsId: string; channelId: string }>();
  const navigate = useNavigate();
  const me = useMe();
  const [joined, setJoined] = useState(false);
  const writable = useWritable(wsId);
  const channel = useVideoChannel(wsId, channelId, joined);
  const rooms = useChatRooms(wsId);
  const [media, setMedia] = useState<MediaState>({ status: 'idle' });
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [busy, setBusy] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | undefined>(undefined);
  const joinedRef = useRef(false);

  const requestMedia = useCallback(async () => {
    setMedia({ status: 'loading' });
    try {
      const stream = await openMedia();
      stopStream(streamRef.current);
      streamRef.current = stream;
      setMedia({ status: 'ready', stream });
    } catch (error) {
      setMedia({ status: 'error', ...mediaErrorGuide(error) });
    }
  }, []);

  useEffect(() => {
    void requestMedia();
  }, [requestMedia]);

  // 화면을 떠나면 장치를 끄고, 참여 중이었으면 퇴장 처리한다.
  useEffect(
    () => () => {
      stopStream(streamRef.current);
      if (joinedRef.current) void data.video.leave(wsId, channelId).catch(() => undefined);
    },
    [wsId, channelId],
  );

  useEffect(() => {
    if (videoRef.current && media.status === 'ready') videoRef.current.srcObject = media.stream;
  }, [media, joined, camOn]);

  useEffect(() => {
    streamRef.current?.getAudioTracks().forEach((track) => (track.enabled = micOn));
  }, [micOn, media]);
  useEffect(() => {
    streamRef.current?.getVideoTracks().forEach((track) => (track.enabled = camOn));
  }, [camOn, media]);

  if (channel.isLoading) return <LoadingState className="min-h-[60vh]" label="회의실을 불러오는 중이에요" />;
  if (channel.error instanceof DataError && channel.error.code === 'NOT_FOUND') return <MissingRedirect to={`/ws/${wsId}`} />;
  if (channel.isError || !channel.data) {
    return <ErrorState className="min-h-[60vh]" title="회의실을 불러오지 못했어요" action={<Button onClick={() => channel.refetch()}>다시 시도</Button>} />;
  }

  const { channel: info, participants } = channel.data;
  const teamBase = `/ws/${wsId}/team/${info.teamId}`;
  const teamRoom = rooms.data?.find((item) => item.room.teamId === info.teamId);
  const hasMedia = media.status === 'ready';
  const others = participants.filter((account) => account.id !== me.data?.id);

  const join = async () => {
    setBusy(true);
    try {
      await data.video.join(wsId, channelId);
      joinedRef.current = true;
      setJoined(true);
      await channel.refetch();
    } catch (error) {
      toast.error(`회의에 들어가지 못했어요. ${errorMessage(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    setBusy(true);
    try {
      await data.video.leave(wsId, channelId);
      joinedRef.current = false;
      stopStream(streamRef.current);
      toast.success('회의에서 나왔어요.');
      navigate(teamBase);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const selfTile = (
    <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-card bg-neutral-900">
      {hasMedia && camOn ? (
        <video ref={videoRef} autoPlay playsInline muted className="h-full w-full -scale-x-100 object-cover" aria-label="내 카메라 미리보기" />
      ) : (
        <Avatar name={me.data?.name} imageUrl={me.data?.profileImageUrl} size="xl" />
      )}
      <span className="absolute bottom-2 left-2 rounded-md bg-black/60 px-2 py-0.5 text-xs text-white">
        {me.data?.name} (나){!micOn || !hasMedia ? ' · 음소거' : ''}
      </span>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold leading-8">{info.name}</h1>
          <p className="text-sm text-muted tabular-nums">
            {joined ? `참여자 ${participants.length}명` : participants.length > 0 ? `지금 ${participants.length}명이 회의 중이에요` : '아직 아무도 없어요'}
          </p>
        </div>
        {teamRoom && (
          <Link to={`/ws/${wsId}/chat/${teamRoom.room.id}`} className={buttonClassName('outline', 'sm')}>
            <ChatBubbleLeftRightIcon className="h-4 w-4" aria-hidden="true" />팀 채팅
          </Link>
        )}
      </header>

      {data.kind === 'mock' && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-warning">목업 데이터에서는 다른 참여자의 영상과 소리가 연결되지 않아요. 참여와 퇴장 기록만 남아요.</p>
      )}

      {!joined ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <section aria-labelledby="vid-preview" className="space-y-3">
            <h2 id="vid-preview" className="sr-only">
              들어가기 전 확인
            </h2>
            {selfTile}
            {media.status === 'error' && (
              <div role="alert" className="rounded-card border border-amber-200 bg-amber-50 p-4 text-sm">
                <p className="flex items-center gap-2 font-semibold text-warning">
                  <ExclamationTriangleIcon className="h-5 w-5" aria-hidden="true" />
                  {media.title}
                </p>
                <p className="mt-1 leading-6">{media.description}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={requestMedia}>
                    다시 시도
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setMedia({ status: 'skipped' })}>
                    장치 없이 참여
                  </Button>
                </div>
              </div>
            )}
            {media.status === 'loading' && <p role="status" className="text-sm text-muted">카메라와 마이크를 확인하는 중이에요</p>}
            <div className="flex justify-center gap-3">
              <MediaToggle on={micOn && hasMedia} label="마이크" disabled={!hasMedia} onClick={() => setMicOn((value) => !value)} onIcon={<MicrophoneIcon className="h-6 w-6" aria-hidden="true" />} offIcon={<MicrophoneIcon className="h-6 w-6" aria-hidden="true" />} />
              <MediaToggle on={camOn && hasMedia} label="카메라" disabled={!hasMedia} onClick={() => setCamOn((value) => !value)} onIcon={<VideoCameraIcon className="h-6 w-6" aria-hidden="true" />} offIcon={<VideoCameraSlashIcon className="h-6 w-6" aria-hidden="true" />} />
            </div>
          </section>
          <section aria-labelledby="vid-join" className="rounded-card border border-outline-soft bg-surface p-5">
            <h2 id="vid-join" className="text-base font-bold">
              참여 준비
            </h2>
            {participants.length > 0 ? (
              <ul className="mt-3 space-y-1.5" aria-label="지금 참여 중">
                {participants.map((account) => (
                  <li key={account.id} className="flex items-center gap-2 text-sm">
                    <Avatar name={account.name} imageUrl={account.profileImageUrl} size="xs" />
                    {account.name}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted">먼저 들어가서 팀원을 기다려 보세요.</p>
            )}
            {writable ? (
              <Button className="mt-5 w-full" onClick={join} loading={busy} disabled={media.status === 'loading' || media.status === 'idle'}>
                {hasMedia ? '참여하기' : '장치 없이 참여하기'}
              </Button>
            ) : (
              <p role="note" className="mt-5 rounded-lg bg-surface-container px-4 py-3 text-sm text-muted">
                보관된 워크스페이스라 회의에 참여할 수 없어요.
              </p>
            )}
            <Link to={teamBase} className="mt-2 inline-flex min-h-touch w-full items-center justify-center text-sm font-semibold text-muted hover:text-ink">
              팀 스페이스로 돌아가기
            </Link>
          </section>
        </div>
      ) : (
        <div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="참여자">
            <li>{selfTile}</li>
            {others.map((account) => (
              <li key={account.id} className="relative flex aspect-video items-center justify-center overflow-hidden rounded-card bg-neutral-800">
                <Avatar name={account.name} imageUrl={account.profileImageUrl} size="xl" />
                <span className="absolute bottom-2 left-2 rounded-md bg-black/60 px-2 py-0.5 text-xs text-white">{account.name}</span>
                {data.kind === 'mock' && (
                  <span className="absolute right-2 top-2">
                    <Badge tone="neutral">영상 없음</Badge>
                  </span>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-5 flex justify-center gap-3" role="toolbar" aria-label="회의 조작">
            <MediaToggle on={micOn && hasMedia} label="마이크" disabled={!hasMedia} onClick={() => setMicOn((value) => !value)} onIcon={<MicrophoneIcon className="h-6 w-6" aria-hidden="true" />} offIcon={<MicrophoneIcon className="h-6 w-6" aria-hidden="true" />} />
            <MediaToggle on={camOn && hasMedia} label="카메라" disabled={!hasMedia} onClick={() => setCamOn((value) => !value)} onIcon={<VideoCameraIcon className="h-6 w-6" aria-hidden="true" />} offIcon={<VideoCameraSlashIcon className="h-6 w-6" aria-hidden="true" />} />
            <button type="button" onClick={leave} disabled={busy} className="inline-flex h-12 items-center gap-2 rounded-full bg-danger px-5 font-semibold text-white disabled:opacity-60">
              <PhoneXMarkIcon className="h-5 w-5" aria-hidden="true" />
              나가기
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
