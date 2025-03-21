import type { FC } from 'react'
import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'
import {
  RiChatCheckLine,
  RiClipboardLine,
  RiEditLine,
  RiResetLeftLine,
  RiThumbDownLine,
  RiThumbUpLine,
} from '@remixicon/react'
import type { ChatItem } from '../../types'
import { useChatContext } from '../context'
import copy from 'copy-to-clipboard'
import Toast from '@/app/components/base/toast'
import EditReplyModal from '@/app/components/app/annotation/edit-annotation-modal'
import Log from '@/app/components/base/chat/chat/log'
import ActionButton, { ActionButtonState } from '@/app/components/base/action-button'
import NewAudioButton from '@/app/components/base/new-audio-button'
import cn from '@/utils/classnames'

// 导入ChatWithHistory上下文
import { useChatWithHistoryContext } from '../../chat-with-history/context'

type OperationProps = {
  item: ChatItem
  question: string
  index: number
  showPromptLog?: boolean
  maxSize: number
  contentWidth: number
  hasWorkflowProcess: boolean
  noChatInput?: boolean
}
const Operation: FC<OperationProps> = ({
  item,
  question,
  index,
  showPromptLog,
  maxSize,
  contentWidth,
  hasWorkflowProcess,
  noChatInput,
}) => {
  const { t } = useTranslation()
  const {
    config,
    onAnnotationAdded,
    onAnnotationEdited,
    onAnnotationRemoved,
    onFeedback,
    onRegenerate,
  } = useChatContext()

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const chatWithHistoryContext = useChatWithHistoryContext ? useChatWithHistoryContext() : null

  const [isShowReplyModal, setIsShowReplyModal] = useState(false)
  const [showCustomOptions, setShowCustomOptions] = useState(false)
  const customButtonRef = useRef<HTMLDivElement>(null)
  const {
    id,
    isOpeningStatement,
    content: messageContent,
    annotation,
    feedback,
    adminFeedback,
    agent_thoughts,
  } = item
  const [localFeedback, setLocalFeedback] = useState(config?.supportAnnotation ? adminFeedback : feedback)

  const content = useMemo(() => {
    if (agent_thoughts?.length)
      return agent_thoughts.reduce((acc, cur) => acc + cur.thought, '')

    return messageContent
  }, [agent_thoughts, messageContent])

  // 从消息内容中提取选项
  const extractOptions = useMemo(() => {
    if (!content) return []

    // 分割内容，找到指令部分的起始位置
    const lines = content.split('\n')
    const instructionIndex = lines.findIndex(line => line.trim().startsWith('> 指令：'))

    // 如果找到了指令部分，只处理指令前的内容
    const contentToProcess = instructionIndex !== -1
      ? lines.slice(0, instructionIndex).join('\n')
      : content

    // 使用正则表达式匹配数字开头的行作为选项
    const optionRegex = /^\s*(\d+)\.\s+(.+)$/gm
    const options: { number: string, text: string }[] = []

    let match = optionRegex.exec(contentToProcess)
    while (match !== null) {
      options.push({
        number: match[1],
        text: match[2].trim(),
      })
      match = optionRegex.exec(contentToProcess)
    }

    return options
  }, [content])

  const handleFeedback = async (rating: 'like' | 'dislike' | null) => {
    if (!config?.supportFeedback || !onFeedback)
      return

    await onFeedback?.(id, { rating })
    setLocalFeedback({ rating })
  }

  const operationWidth = useMemo(() => {
    let width = 0
    if (!isOpeningStatement)
      width += 28
    if (!isOpeningStatement && showPromptLog)
      width += 102 + 8
    if (!isOpeningStatement && config?.text_to_speech?.enabled)
      width += 33
    if (!isOpeningStatement && config?.supportAnnotation && config?.annotation_reply?.enabled)
      width += 56 + 8
    if (config?.supportFeedback && !localFeedback?.rating && onFeedback && !isOpeningStatement)
      width += 60 + 8
    if (config?.supportFeedback && localFeedback?.rating && onFeedback && !isOpeningStatement)
      width += 28 + 8
    return width
  }, [isOpeningStatement, showPromptLog, config?.text_to_speech?.enabled, config?.supportAnnotation, config?.annotation_reply?.enabled, config?.supportFeedback, localFeedback?.rating, onFeedback])

  const positionRight = useMemo(() => operationWidth < maxSize, [operationWidth, maxSize])

  // 关闭自定义选项弹窗的处理函数
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (customButtonRef.current && !customButtonRef.current.contains(event.target as Node))
        setShowCustomOptions(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // 选项点击处理函数
  const handleOptionClick = (optionText: string, optionNumber: string) => {
    console.log('选择的选项:', { number: optionNumber, text: optionText })
    console.log('当前消息数据:', item)

    // 处理表单数据并跳转
    if (chatWithHistoryContext) {
      const currentInputs = chatWithHistoryContext.currentConversationId
        ? chatWithHistoryContext.currentConversationItem?.inputs
        : chatWithHistoryContext.newConversationInputs

      console.log('InputsForms数据:', {
        inputsForms: chatWithHistoryContext.inputsForms,
        currentInputs,
      })

      // 1. 获取当前的text值
      const currentText = currentInputs?.text || ''

      // 2. 将选项文本（去掉编号）添加到下一行
      const newText = `${currentText.trim()}\n${optionText}`

      try {
        // 编码文本，用于URL参数
        const encodedText = encodeURIComponent(newText)

        // 从环境变量中获取工作流路径，如果不存在则使用默认值
        const workflowPath = process.env.NEXT_PUBLIC_KEPU_WORKFLOW_PATH || ''

        // 处理路径，确保格式正确（移除开头的斜杠，避免重复）
        const formattedPath = workflowPath.startsWith('/') ? workflowPath.substring(1) : workflowPath

        // 获取当前页面的域名和协议
        const currentUrl = window.location.origin

        // 构建完整的目标URL
        const targetUrl = `${currentUrl}/${formattedPath}?autoFillText=${encodedText}`

        // 通知用户
        Toast.notify({ type: 'info', message: '正在跳转并自动填充表单...' })

        // 跳转到目标页面
        window.location.href = targetUrl
      }
      catch (error) {
        console.error('设置自动填充时出错:', error)
        Toast.notify({ type: 'error', message: '设置自动填充失败' })

        // 出错时仍然跳转，但可能不会自动填充
        const workflowPath = process.env.NEXT_PUBLIC_KEPU_WORKFLOW_PATH || ''
        const formattedPath = workflowPath.startsWith('/') ? workflowPath.substring(1) : workflowPath
        const currentUrl = window.location.origin
        window.location.href = `${currentUrl}/${formattedPath}`
      }
    }
    else {
      console.log('ChatWithHistory上下文不可用')
      Toast.notify({ type: 'error', message: '无法获取表单数据' })
    }

    setShowCustomOptions(false)
  }

  // 点击自定义按钮时也打印消息数据
  const handleCustomButtonClick = () => {
    console.log('消息数据:', item)

    // 打印inputsForms数据（如果可用）
    if (chatWithHistoryContext) {
      console.log('InputsForms数据:', {
        inputsForms: chatWithHistoryContext.inputsForms,
        currentInputs: chatWithHistoryContext.currentConversationId
          ? chatWithHistoryContext.currentConversationItem?.inputs
          : chatWithHistoryContext.newConversationInputs,
      })
    }
    else {
      console.log('ChatWithHistory上下文不可用')
    }

    setShowCustomOptions(!showCustomOptions)
  }

  return (
    <>
      <div
        className={cn(
          'absolute flex justify-end gap-1',
          hasWorkflowProcess && '-bottom-4 right-2',
          !positionRight && '-bottom-4 right-2',
          !hasWorkflowProcess && positionRight && '!top-[9px]',
        )}
        style={(!hasWorkflowProcess && positionRight) ? { left: contentWidth + 8 } : {}}
      >
        {showPromptLog && (
          <div className='hidden group-hover:block'>
            <Log logItem={item} />
          </div>
        )}
        {!isOpeningStatement && (
          <div className='hidden group-hover:flex ml-1 items-center gap-0.5 p-0.5 rounded-[10px] border-[0.5px] border-components-actionbar-border bg-components-actionbar-bg shadow-md backdrop-blur-sm'>
            {(config?.text_to_speech?.enabled) && (
              <NewAudioButton
                id={id}
                value={content}
                voice={config?.text_to_speech?.voice}
              />
            )}
            <ActionButton onClick={() => {
              copy(content)
              Toast.notify({ type: 'success', message: t('common.actionMsg.copySuccessfully') })
            }}>
              <RiClipboardLine className='w-4 h-4' />
            </ActionButton>
            {!noChatInput && (
              <ActionButton onClick={() => onRegenerate?.(item)}>
                <RiResetLeftLine className='w-4 h-4' />
              </ActionButton>
            )}
            {(config?.supportAnnotation && config.annotation_reply?.enabled) && (
              <ActionButton onClick={() => setIsShowReplyModal(true)}>
                <RiEditLine className='w-4 h-4' />
              </ActionButton>
            )}
            <div className="relative" ref={customButtonRef}>
              <ActionButton onClick={handleCustomButtonClick}>
                <RiChatCheckLine className='w-4 h-4' />
              </ActionButton>

              {showCustomOptions && (
                <div className="absolute bottom-full mb-1 right-0 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[250px] z-10">
                  {extractOptions.length > 0 ? (
                    extractOptions.map((option, index) => (
                      <div
                        key={index}
                        className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                        onClick={() => handleOptionClick(option.text, option.number)}
                      >
                        {option.number}. {option.text}
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-2 text-gray-500">没有可用选项</div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        {!isOpeningStatement && config?.supportFeedback && onFeedback && (
          <div className='hidden group-hover:flex ml-1 items-center gap-0.5 p-0.5 rounded-[10px] border-[0.5px] border-components-actionbar-border bg-components-actionbar-bg shadow-md backdrop-blur-sm'>
            {!localFeedback?.rating && (
              <>
                <ActionButton onClick={() => handleFeedback('like')}>
                  <RiThumbUpLine className='w-4 h-4' />
                </ActionButton>
                <ActionButton onClick={() => handleFeedback('dislike')}>
                  <RiThumbDownLine className='w-4 h-4' />
                </ActionButton>
              </>
            )}
            {localFeedback?.rating === 'like' && (
              <ActionButton state={ActionButtonState.Active} onClick={() => handleFeedback(null)}>
                <RiThumbUpLine className='w-4 h-4' />
              </ActionButton>
            )}
            {localFeedback?.rating === 'dislike' && (
              <ActionButton state={ActionButtonState.Destructive} onClick={() => handleFeedback(null)}>
                <RiThumbDownLine className='w-4 h-4' />
              </ActionButton>
            )}
          </div>
        )}
      </div>
      <EditReplyModal
        isShow={isShowReplyModal}
        onHide={() => setIsShowReplyModal(false)}
        query={question}
        answer={content}
        onEdited={(editedQuery, editedAnswer) => onAnnotationEdited?.(editedQuery, editedAnswer, index)}
        onAdded={(annotationId, authorName, editedQuery, editedAnswer) => onAnnotationAdded?.(annotationId, authorName, editedQuery, editedAnswer, index)}
        appId={config?.appId || ''}
        messageId={id}
        annotationId={annotation?.id || ''}
        createdAt={annotation?.created_at}
        onRemove={() => onAnnotationRemoved?.(index)}
      />
    </>
  )
}

export default memo(Operation)
