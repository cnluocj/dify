import type { FC, FormEvent } from 'react'
import React, { useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  RiPlayLargeLine,
} from '@remixicon/react'
import { useSearchParams } from 'next/navigation'
import Select from '@/app/components/base/select'
import type { SiteInfo } from '@/models/share'
import type { PromptConfig } from '@/models/debug'
import Button from '@/app/components/base/button'
import Textarea from '@/app/components/base/textarea'
import Input from '@/app/components/base/input'
import { DEFAULT_VALUE_MAX_LEN } from '@/config'
import TextGenerationImageUploader from '@/app/components/base/image-uploader/text-generation-image-uploader'
import type { VisionFile, VisionSettings } from '@/types/app'
import { FileUploaderInAttachmentWrapper } from '@/app/components/base/file-uploader'
import { getProcessedFiles } from '@/app/components/base/file-uploader/utils'
import useBreakpoints, { MediaType } from '@/hooks/use-breakpoints'
import cn from '@/utils/classnames'

export type IRunOnceProps = {
  siteInfo: SiteInfo
  promptConfig: PromptConfig
  inputs: Record<string, any>
  inputsRef: React.MutableRefObject<Record<string, any>>
  onInputsChange: (inputs: Record<string, any>) => void
  onSend: () => void
  visionConfig: VisionSettings
  onVisionFilesChange: (files: VisionFile[]) => void
}
const RunOnce: FC<IRunOnceProps> = ({
  promptConfig,
  inputs,
  inputsRef,
  onInputsChange,
  onSend,
  visionConfig,
  onVisionFilesChange,
}) => {
  const { t } = useTranslation()
  const media = useBreakpoints()
  const isPC = media === MediaType.pc
  const searchParams = useSearchParams()

  // 从URL参数中读取autoFillText，并自动填充表单字段
  useEffect(() => {
    const autoFillText = searchParams.get('autoFillText')
    if (autoFillText) {
      try {
        const decodedText = decodeURIComponent(autoFillText)
        console.log('从URL参数中读取到文本:', decodedText)

        // 检查所有可能的字段类型，优先填充paragraph类型
        // 1. 首先尝试找到paragraph类型的变量
        const paragraphVar = promptConfig.prompt_variables.find(item => item.type === 'paragraph')

        // 2. 如果没有paragraph类型，尝试找text类型
        const textVar = !paragraphVar && promptConfig.prompt_variables.find(item =>
          item.type === 'string' || item.name.toLowerCase().includes('text'),
        )

        // 3. 如果都没有找到，使用第一个变量
        const targetVar = paragraphVar || textVar || promptConfig.prompt_variables[0]

        if (targetVar) {
          // 自动填充文本
          const newInputs = { ...inputsRef.current }
          newInputs[targetVar.key] = decodedText
          onInputsChange(newInputs)
          console.log('表单已自动填充到字段:', targetVar.name)

          // 如果用户希望自动提交，可以取消注释下面一行
          // setTimeout(() => onSend(), 500)
        }
        else {
          console.warn('未找到合适的表单字段用于自动填充')
        }
      }
      catch (err) {
        console.error('处理URL参数时出错:', err)
      }
    }
    else {
      console.log('URL中没有自动填充参数')
    }
  }, [searchParams, promptConfig.prompt_variables, inputsRef, onInputsChange])

  const onClear = () => {
    const newInputs: Record<string, any> = {}
    promptConfig.prompt_variables.forEach((item) => {
      newInputs[item.key] = ''
    })
    onInputsChange(newInputs)
  }

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    onSend()
  }

  const handleInputsChange = useCallback((newInputs: Record<string, any>) => {
    onInputsChange(newInputs)
    inputsRef.current = newInputs
  }, [onInputsChange, inputsRef])

  return (
    <div className="">
      <section>
        {/* input form */}
        <form onSubmit={onSubmit}>
          {promptConfig.prompt_variables.map(item => (
            <div className='w-full mt-4' key={item.key}>
              <label className='h-6 flex items-center text-text-secondary system-md-semibold'>{item.name}</label>
              <div className='mt-1'>
                {item.type === 'select' && (
                  <Select
                    className='w-full'
                    defaultValue={inputs[item.key]}
                    onSelect={(i) => { handleInputsChange({ ...inputsRef.current, [item.key]: i.value }) }}
                    items={(item.options || []).map(i => ({ name: i, value: i }))}
                    allowSearch={false}
                  />
                )}
                {item.type === 'string' && (
                  <Input
                    type="text"
                    placeholder={`${item.name}${!item.required ? `(${t('appDebug.variableTable.optional')})` : ''}`}
                    value={inputs[item.key]}
                    onChange={(e) => { handleInputsChange({ ...inputsRef.current, [item.key]: e.target.value }) }}
                    maxLength={item.max_length || DEFAULT_VALUE_MAX_LEN}
                  />
                )}
                {item.type === 'paragraph' && (
                  <Textarea
                    className='h-[104px] sm:text-xs'
                    placeholder={`${item.name}${!item.required ? `(${t('appDebug.variableTable.optional')})` : ''}`}
                    value={inputs[item.key]}
                    onChange={(e) => { handleInputsChange({ ...inputsRef.current, [item.key]: e.target.value }) }}
                  />
                )}
                {item.type === 'number' && (
                  <Input
                    type="number"
                    placeholder={`${item.name}${!item.required ? `(${t('appDebug.variableTable.optional')})` : ''}`}
                    value={inputs[item.key]}
                    onChange={(e) => { handleInputsChange({ ...inputsRef.current, [item.key]: e.target.value }) }}
                  />
                )}
                {item.type === 'file' && (
                  <FileUploaderInAttachmentWrapper
                    onChange={(files) => { handleInputsChange({ ...inputsRef.current, [item.key]: getProcessedFiles(files)[0] }) }}
                    fileConfig={{
                      ...item.config,
                      fileUploadConfig: (visionConfig as any).fileUploadConfig,
                    }}
                  />
                )}
                {item.type === 'file-list' && (
                  <FileUploaderInAttachmentWrapper
                    onChange={(files) => { handleInputsChange({ ...inputsRef.current, [item.key]: getProcessedFiles(files) }) }}
                    fileConfig={{
                      ...item.config,
                      fileUploadConfig: (visionConfig as any).fileUploadConfig,
                    }}
                  />
                )}
              </div>
            </div>
          ))}
          {
            visionConfig?.enabled && (
              <div className="w-full mt-4">
                <div className="h-6 flex items-center text-text-secondary system-md-semibold">{t('common.imageUploader.imageUpload')}</div>
                <div className='mt-1'>
                  <TextGenerationImageUploader
                    settings={visionConfig}
                    onFilesChange={files => onVisionFilesChange(files.filter(file => file.progress !== -1).map(fileItem => ({
                      type: 'image',
                      transfer_method: fileItem.type,
                      url: fileItem.url,
                      upload_file_id: fileItem.fileId,
                    })))}
                  />
                </div>
              </div>
            )
          }
          <div className='w-full mt-6 mb-3'>
            <div className="flex items-center justify-between gap-2">
              <Button
                onClick={onClear}
                disabled={false}
              >
                <span className='text-[13px]'>{t('common.operation.clear')}</span>
              </Button>
              <Button
                className={cn(!isPC && 'grow')}
                type='submit'
                variant="primary"
                disabled={false}
              >
                <RiPlayLargeLine className="shrink-0 w-4 h-4 mr-1" aria-hidden="true" />
                <span className='text-[13px]'>{t('share.generation.run')}</span>
              </Button>
            </div>
          </div>
        </form>
      </section>
    </div>
  )
}
export default React.memo(RunOnce)
