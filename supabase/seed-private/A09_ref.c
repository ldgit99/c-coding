#include <stdio.h>

int main(void)
{
    FILE *fp;

    char message[] = "Let's wrap it up here.";
    char readMessage[100];

    // hello.txt 파일을 쓰기 모드로 연다.
    fp = fopen("hello.txt", "w");

    // 파일 열기 실패 검사
    if (fp == NULL) {
        printf("파일을 열 수 없습니다.\n");
        return 1;
    }

    // message 문자열을 파일에 저장한다.
    fprintf(fp, message);

    fclose(fp);

    // hello.txt 파일을 읽기 모드로 연다.
    fp = fopen("hello.txt", "r");

    // 파일 열기 실패 검사
    if (fp == NULL) {
        printf("파일을 열 수 없습니다.\n");
        return 1;
    }

    // fgets 함수를 사용하여 파일에서 문자열을 읽는다.
    fgets(readMessage, 100, fp);

    // 읽은 문자열을 화면에 출력한다.
    printf("파일에서 읽은 문자열: %s", readMessage);

    fclose(fp);

    return 0;
}
