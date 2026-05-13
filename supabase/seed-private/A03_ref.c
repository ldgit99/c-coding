#include <stdio.h>
#include <ctype.h>

int main() {
    int ch;

    while (1) {
        printf("\n키보드로부터 1개의 문자 입력(반복 종료: Ctrl+Z)>> ");

        ch = getchar();

        // EOF 입력 시 반복 종료
        if (ch == EOF) {
            break;
        }

        // 대문자로 변환 후 출력
        putchar(toupper(ch));
        printf("\n");

        // 입력 버퍼 비우기
        while ((ch = getchar()) != '\n' && ch != EOF) {
        }
    }

    printf("\nEOF가 입력되어 반복 종료함");

    return 0;
}
